const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getItemWithStock(id) {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) return null;
  const stock = db.prepare(`
    SELECT sl.quantity, sl.updated_at, l.id as location_id, l.name as location_name, l.code as location_code
    FROM stock_levels sl JOIN locations l ON sl.location_id = l.id
    WHERE sl.item_id = ?
  `).all(id);
  const total_quantity = stock.reduce((s, r) => s + r.quantity, 0);
  return { ...item, stock_by_location: stock, total_quantity };
}

function updateStockLevel(itemId, locationId, deltaQty) {
  const existing = db.prepare('SELECT id, quantity FROM stock_levels WHERE item_id = ? AND location_id = ?').get(itemId, locationId);
  if (existing) {
    db.prepare("UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?")
      .run(deltaQty, existing.id);
  } else {
    db.prepare("INSERT INTO stock_levels (id, item_id, location_id, quantity) VALUES (?, ?, ?, ?)").run(uuidv4(), itemId, locationId, Math.max(0, deltaQty));
  }
}

// ─── GET /items ───────────────────────────────────────────────────────────────

router.get('/items', (req, res) => {
  const { category, search, low_stock } = req.query;

  let sql = `
    SELECT i.*,
      COALESCE(SUM(sl.quantity), 0) as total_quantity,
      COALESCE(SUM(sl.quantity * i.unit_cost), 0) as total_value
    FROM items i
    LEFT JOIN stock_levels sl ON sl.item_id = i.id
  `;
  const params = [];
  const where = ['1=1'];

  if (category) { where.push('i.category = ?'); params.push(category); }
  if (search)   { where.push('(i.name LIKE ? OR i.sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  sql += ` WHERE ${where.join(' AND ')} GROUP BY i.id`;

  if (low_stock === '1') sql += ' HAVING total_quantity <= i.reorder_point AND i.is_active = 1';
  sql += ' ORDER BY i.category, i.name';

  const items = db.prepare(sql).all(...params);
  res.json(items);
});

// ─── GET /items/summary ───────────────────────────────────────────────────────

router.get('/items/summary', (req, res) => {
  const total_items = db.prepare('SELECT COUNT(*) as c FROM items WHERE is_active = 1').get().c;
  const total_value = db.prepare(`
    SELECT COALESCE(SUM(sl.quantity * i.unit_cost), 0) as v
    FROM stock_levels sl JOIN items i ON i.id = sl.item_id WHERE i.is_active = 1
  `).get().v;
  const low_stock = db.prepare(`
    SELECT COUNT(*) as c FROM (
      SELECT i.id FROM items i
      LEFT JOIN stock_levels sl ON sl.item_id = i.id
      WHERE i.is_active = 1
      GROUP BY i.id HAVING COALESCE(SUM(sl.quantity), 0) <= i.reorder_point
    )
  `).get().c;
  const categories = db.prepare('SELECT DISTINCT category FROM items WHERE is_active = 1 ORDER BY category').all().map(r => r.category);
  const today_receives = db.prepare("SELECT COUNT(*) as c FROM stock_movements WHERE movement_type = 'receive' AND date(created_at) = date('now')").get().c;
  const today_consumes = db.prepare("SELECT ABS(COALESCE(SUM(quantity),0)) as c FROM stock_movements WHERE movement_type = 'consume' AND date(created_at) = date('now')").get().c;
  res.json({ total_items, total_value, low_stock, categories, today_receives, today_consumes });
});

// ─── GET /items/:id ───────────────────────────────────────────────────────────

router.get('/items/:id', (req, res) => {
  const item = getItemWithStock(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const movements = db.prepare(`
    SELECT sm.*, l.name as location_name, l.code as location_code
    FROM stock_movements sm LEFT JOIN locations l ON l.id = sm.location_id
    WHERE sm.item_id = ? ORDER BY sm.created_at DESC LIMIT 50
  `).all(req.params.id);
  res.json({ ...item, movements });
});

// ─── POST /items ──────────────────────────────────────────────────────────────

router.post('/items', (req, res) => {
  const { sku, name, description = '', category = 'General', unit_of_measure = 'ea',
          unit_cost = 0, reorder_point = 0, reorder_qty = 0, lead_time_days = 7 } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'sku and name required' });
  const existing = db.prepare('SELECT id FROM items WHERE sku = ?').get(sku);
  if (existing) return res.status(409).json({ error: 'SKU already exists' });
  const id = uuidv4();
  db.prepare(`INSERT INTO items (id, sku, name, description, category, unit_of_measure, unit_cost, reorder_point, reorder_qty, lead_time_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, sku, name, description, category, unit_of_measure, unit_cost, reorder_point, reorder_qty, lead_time_days);
  res.status(201).json(getItemWithStock(id));
});

// ─── PUT /items/:id ───────────────────────────────────────────────────────────

router.put('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const fields = ['sku','name','description','category','unit_of_measure','unit_cost','reorder_point','reorder_qty','lead_time_days','is_active'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (Object.keys(updates).length === 0) return res.json(getItemWithStock(req.params.id));
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE items SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(getItemWithStock(req.params.id));
});

// ─── DELETE /items/:id ────────────────────────────────────────────────────────

router.delete('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE items SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ─── GET /locations ───────────────────────────────────────────────────────────

router.get('/locations', (req, res) => {
  const locs = db.prepare(`
    SELECT l.*, COUNT(DISTINCT sl.item_id) as item_count, COALESCE(SUM(sl.quantity), 0) as total_units
    FROM locations l LEFT JOIN stock_levels sl ON sl.location_id = l.id
    WHERE l.is_active = 1 GROUP BY l.id ORDER BY l.name
  `).all();
  res.json(locs);
});

// ─── POST /locations ──────────────────────────────────────────────────────────

router.post('/locations', (req, res) => {
  const { name, code, description = '', type = 'warehouse' } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code required' });
  const id = uuidv4();
  db.prepare(`INSERT INTO locations (id, name, code, description, type) VALUES (?, ?, ?, ?, ?)`).run(id, name, code, description, type);
  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id = ?').get(id));
});

// ─── PUT /locations/:id ───────────────────────────────────────────────────────

router.put('/locations/:id', (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  const { name, code, description, type, is_active } = req.body;
  db.prepare(`UPDATE locations SET name=COALESCE(?,name), code=COALESCE(?,code), description=COALESCE(?,description), type=COALESCE(?,type), is_active=COALESCE(?,is_active) WHERE id=?`)
    .run(name, code, description, type, is_active, req.params.id);
  res.json(db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id));
});

// ─── DELETE /locations/:id ────────────────────────────────────────────────────

router.delete('/locations/:id', (req, res) => {
  db.prepare("UPDATE locations SET is_active = 0 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ─── POST /movements ──────────────────────────────────────────────────────────

router.post('/movements', (req, res) => {
  const { item_id, location_id, movement_type, quantity, unit_cost = 0,
          reference_type = '', reference_id = '', notes = '', operator_name = '' } = req.body;
  if (!item_id || !movement_type || quantity === undefined) {
    return res.status(400).json({ error: 'item_id, movement_type, quantity required' });
  }
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const validTypes = ['receive', 'consume', 'adjust', 'transfer', 'ship', 'scrap', 'return'];
  if (!validTypes.includes(movement_type)) return res.status(400).json({ error: `movement_type must be one of: ${validTypes.join(', ')}` });

  const id = uuidv4();
  const qty = parseFloat(quantity);
  const signedQty = ['receive', 'return'].includes(movement_type) ? Math.abs(qty)
    : ['consume', 'ship', 'scrap'].includes(movement_type) ? -Math.abs(qty)
    : qty; // adjust and transfer use signed quantity as-is

  db.prepare(`INSERT INTO stock_movements (id, item_id, location_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, item_id, location_id || null, movement_type, signedQty, unit_cost, reference_type, reference_id, notes, operator_name);

  if (location_id) updateStockLevel(item_id, location_id, signedQty);

  const mov = db.prepare(`
    SELECT sm.*, l.name as location_name FROM stock_movements sm
    LEFT JOIN locations l ON l.id = sm.location_id WHERE sm.id = ?
  `).get(id);
  res.status(201).json(mov);
});

// ─── GET /movements ───────────────────────────────────────────────────────────

router.get('/movements', (req, res) => {
  const { item_id, movement_type, days = 30, limit = 100 } = req.query;
  let sql = `
    SELECT sm.*, i.name as item_name, i.sku, l.name as location_name, l.code as location_code
    FROM stock_movements sm
    JOIN items i ON i.id = sm.item_id
    LEFT JOIN locations l ON l.id = sm.location_id
    WHERE sm.created_at >= datetime('now', ?)
  `;
  const params = [`-${days} days`];
  if (item_id)       { sql += ' AND sm.item_id = ?';        params.push(item_id); }
  if (movement_type) { sql += ' AND sm.movement_type = ?';  params.push(movement_type); }
  sql += ` ORDER BY sm.created_at DESC LIMIT ?`;
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
