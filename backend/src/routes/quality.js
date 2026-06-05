const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextNCRNumber() {
  const year = new Date().getFullYear();
  const row = db.prepare(`SELECT ncr_number FROM ncrs WHERE ncr_number LIKE 'NCR-${year}-%' ORDER BY ncr_number DESC LIMIT 1`).get();
  if (!row) return `NCR-${year}-001`;
  const last = parseInt(row.ncr_number.split('-')[2]) || 0;
  return `NCR-${year}-${String(last + 1).padStart(3, '0')}`;
}

function getNCRWithDetails(id) {
  const ncr = db.prepare(`
    SELECT n.*,
      a.name as app_name,
      wo.work_order_number,
      i.name as item_name, i.sku as item_sku
    FROM ncrs n
    LEFT JOIN apps a ON a.id = n.app_id
    LEFT JOIN work_orders wo ON wo.id = n.work_order_id
    LEFT JOIN items i ON i.id = n.item_id
    WHERE n.id = ?
  `).get(id);
  if (!ncr) return null;
  const comments = db.prepare('SELECT * FROM ncr_comments WHERE ncr_id = ? ORDER BY created_at ASC').all(id);
  return { ...ncr, comments };
}

// ─── GET /ncrs ────────────────────────────────────────────────────────────────

router.get('/ncrs', (req, res) => {
  const { status, severity, source, search, app_id } = req.query;
  let sql = `
    SELECT n.*,
      a.name as app_name,
      wo.work_order_number,
      i.name as item_name, i.sku as item_sku,
      (SELECT COUNT(*) FROM ncr_comments WHERE ncr_id = n.id) as comment_count
    FROM ncrs n
    LEFT JOIN apps a ON a.id = n.app_id
    LEFT JOIN work_orders wo ON wo.id = n.work_order_id
    LEFT JOIN items i ON i.id = n.item_id
    WHERE 1=1
  `;
  const params = [];
  if (status)   { sql += ' AND n.status = ?';   params.push(status); }
  if (severity) { sql += ' AND n.severity = ?'; params.push(severity); }
  if (source)   { sql += ' AND n.source = ?';   params.push(source); }
  if (app_id)   { sql += ' AND n.app_id = ?';   params.push(app_id); }
  if (search)   { sql += ' AND (n.title LIKE ? OR n.ncr_number LIKE ? OR n.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY CASE n.severity WHEN \'critical\' THEN 1 WHEN \'major\' THEN 2 ELSE 3 END, n.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// ─── GET /ncrs/summary ────────────────────────────────────────────────────────

router.get('/summary', (req, res) => {
  const total    = db.prepare('SELECT COUNT(*) as c FROM ncrs').get().c;
  const open     = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE status = 'open'").get().c;
  const investigating = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE status = 'investigating'").get().c;
  const resolved = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE status = 'resolved'").get().c;
  const closed   = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE status = 'closed'").get().c;
  const critical = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE severity = 'critical' AND status NOT IN ('closed')").get().c;
  const overdue  = db.prepare("SELECT COUNT(*) as c FROM ncrs WHERE due_date < date('now') AND status NOT IN ('resolved','closed')").get().c;
  const by_source = db.prepare("SELECT source, COUNT(*) as count FROM ncrs GROUP BY source ORDER BY count DESC").all();
  const by_severity = db.prepare("SELECT severity, COUNT(*) as count FROM ncrs WHERE status NOT IN ('closed') GROUP BY severity").all();
  res.json({ total, open, investigating, resolved, closed, critical, overdue, by_source, by_severity });
});

// ─── POST /ncrs ───────────────────────────────────────────────────────────────

router.post('/ncrs', (req, res) => {
  const {
    title, description = '', severity = 'minor', source = 'production',
    app_id, completion_id, work_order_id, item_id,
    assigned_to = '', due_date, notes = ''
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = uuidv4();
  const ncr_number = nextNCRNumber();
  db.prepare(`
    INSERT INTO ncrs (id, ncr_number, title, description, severity, status, source, app_id, completion_id, work_order_id, item_id, assigned_to, due_date)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ncr_number, title, description, severity, source, app_id || null, completion_id || null, work_order_id || null, item_id || null, assigned_to, due_date || null);
  res.status(201).json(getNCRWithDetails(id));
});

// ─── GET /ncrs/:id ────────────────────────────────────────────────────────────

router.get('/ncrs/:id', (req, res) => {
  const ncr = getNCRWithDetails(req.params.id);
  if (!ncr) return res.status(404).json({ error: 'Not found' });
  res.json(ncr);
});

// ─── PUT /ncrs/:id ────────────────────────────────────────────────────────────

router.put('/ncrs/:id', (req, res) => {
  const ncr = db.prepare('SELECT * FROM ncrs WHERE id = ?').get(req.params.id);
  if (!ncr) return res.status(404).json({ error: 'Not found' });

  const fields = ['title','description','severity','status','source','app_id','work_order_id','item_id','assigned_to','root_cause','corrective_action','due_date','resolved_at'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];

  // Auto-set resolved_at when status moves to resolved
  if (updates.status === 'resolved' && !ncr.resolved_at && !updates.resolved_at) {
    updates.resolved_at = new Date().toISOString();
  }

  if (!Object.keys(updates).length) return res.json(getNCRWithDetails(req.params.id));
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE ncrs SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(getNCRWithDetails(req.params.id));
});

// ─── POST /ncrs/:id/comments ──────────────────────────────────────────────────

router.post('/ncrs/:id/comments', (req, res) => {
  const ncr = db.prepare('SELECT id FROM ncrs WHERE id = ?').get(req.params.id);
  if (!ncr) return res.status(404).json({ error: 'Not found' });
  const { author, body } = req.body;
  if (!author || !body) return res.status(400).json({ error: 'author and body required' });
  const id = uuidv4();
  db.prepare(`INSERT INTO ncr_comments (id, ncr_id, author, body) VALUES (?, ?, ?, ?)`).run(id, req.params.id, author, body);
  db.prepare("UPDATE ncrs SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM ncr_comments WHERE id = ?').get(id));
});

// ─── DELETE /ncrs/:id ─────────────────────────────────────────────────────────

router.delete('/ncrs/:id', (req, res) => {
  const ncr = db.prepare('SELECT * FROM ncrs WHERE id = ?').get(req.params.id);
  if (!ncr) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM ncrs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
