const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCompletion(c) {
  return {
    ...c,
    data:                JSON.parse(c.data || '{}'),
    step_times:          JSON.parse(c.step_times || '{}'),
    takt_exceeded_steps: JSON.parse(c.takt_exceeded_steps || '[]'),
  };
}

// ─── GET / - list completions (with optional status filter) ───────────────────

router.get('/', (req, res) => {
  const { limit = 50, status } = req.query;
  let query  = 'SELECT * FROM completions';
  const params = [];
  if (status) { query += ' WHERE status = ?'; params.push(status); }
  query += ' ORDER BY started_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const completions = db.prepare(query).all(...params);
  res.json(completions.map(parseCompletion));
});

// ─── POST / - create a new completion (start) ─────────────────────────────────

router.post('/', (req, res) => {
  const { app_id, station_id, operator_name = 'Unknown', work_order_id } = req.body;
  if (!app_id) return res.status(400).json({ error: 'app_id required' });

  const app = db.prepare('SELECT name FROM apps WHERE id = ?').get(app_id);
  if (!app) return res.status(404).json({ error: 'App not found' });

  // Validate work order if provided
  if (work_order_id) {
    const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(work_order_id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO completions (id, app_id, app_name, station_id, operator_name, work_order_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, app_id, app.name, station_id || null, operator_name, work_order_id || null);

  const completion = db.prepare('SELECT * FROM completions WHERE id = ?').get(id);
  res.status(201).json(parseCompletion(completion));
});

// ─── PUT /:id - update completion (status, data, step_times, takt_exceeded) ───

router.put('/:id', (req, res) => {
  const { status, data, step_times, takt_exceeded_steps, work_order_id } = req.body;
  const completion = db.prepare('SELECT * FROM completions WHERE id = ?').get(req.params.id);
  if (!completion) return res.status(404).json({ error: 'Not found' });

  const wasCompleted = completion.status === 'completed';
  const nowCompleted = (status || completion.status) === 'completed';

  const updates = {
    status:              status               ?? completion.status,
    data:                data !== undefined   ? JSON.stringify(data)               : completion.data,
    step_times:          step_times !== undefined ? JSON.stringify(step_times)     : completion.step_times,
    takt_exceeded_steps: takt_exceeded_steps !== undefined
                           ? JSON.stringify(takt_exceeded_steps)
                           : (completion.takt_exceeded_steps || '[]'),
    work_order_id:       work_order_id !== undefined ? work_order_id : completion.work_order_id,
    completed_at:        nowCompleted ? (completion.completed_at || new Date().toISOString()) : completion.completed_at,
  };

  db.prepare(`
    UPDATE completions
    SET status=?, data=?, step_times=?, takt_exceeded_steps=?, work_order_id=?, completed_at=?
    WHERE id=?
  `).run(
    updates.status, updates.data, updates.step_times, updates.takt_exceeded_steps,
    updates.work_order_id, updates.completed_at, req.params.id
  );

  // If this completion just transitioned to 'completed' and has a work order, increment it
  if (!wasCompleted && nowCompleted && updates.work_order_id) {
    const wo = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(updates.work_order_id);
    if (wo) {
      const newQty    = Math.min(wo.quantity_completed + 1, wo.quantity);
      const newStatus = newQty >= wo.quantity
        ? 'completed'
        : (wo.status === 'pending' ? 'in_progress' : wo.status);
      db.prepare(`
        UPDATE work_orders SET quantity_completed=?, status=?, updated_at=datetime('now') WHERE id=?
      `).run(newQty, newStatus, updates.work_order_id);
    }
  }

  const updated = db.prepare('SELECT * FROM completions WHERE id = ?').get(req.params.id);
  res.json(parseCompletion(updated));
});

// ─── GET /app/:appId/history - paginated completions for an app ───────────────

router.get('/app/:appId/history', (req, res) => {
  const { appId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || '25'), 100);
  const page   = Math.max(1, parseInt(req.query.page   || '1'));
  const offset = (page - 1) * limit;

  const app = db.prepare('SELECT id, name, steps FROM apps WHERE id = ?').get(appId);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const total = db.prepare(`SELECT COUNT(*) as c FROM completions WHERE app_id = ? AND status='completed'`).get(appId).c;

  const rows = db.prepare(`
    SELECT c.*, w.work_order_number
    FROM completions c
    LEFT JOIN work_orders w ON c.work_order_id = w.id
    WHERE c.app_id = ? AND c.status='completed'
    ORDER BY c.started_at DESC
    LIMIT ? OFFSET ?
  `).all(appId, limit, offset);

  // Summary stats
  const stats = db.prepare(`
    SELECT
      AVG((julianday(completed_at)-julianday(started_at))*24*60) as avg_minutes,
      MIN((julianday(completed_at)-julianday(started_at))*24*60) as best_minutes
    FROM completions WHERE app_id=? AND status='completed' AND completed_at IS NOT NULL
  `).get(appId);

  // Trend: last 30 days
  const trend = db.prepare(`
    SELECT date(completed_at) as date,
      AVG((julianday(completed_at)-julianday(started_at))*24*60) as avg_minutes,
      COUNT(*) as count
    FROM completions WHERE app_id=? AND status='completed' AND completed_at >= date('now','-30 days')
    GROUP BY date(completed_at) ORDER BY date ASC
  `).all(appId);

  // Pass rate
  const allData = db.prepare(`SELECT data FROM completions WHERE app_id=? AND status='completed' LIMIT 500`).all(appId);
  let passC = 0, failC = 0;
  for (const row of allData) {
    const d = JSON.parse(row.data || '{}');
    if (Object.values(d).some(v => v === 'Fail')) failC++; else passC++;
  }
  const pass_rate = (passC + failC) > 0 ? Math.round((passC / (passC + failC)) * 100) : 100;

  // Step averages from step_times
  const steps = JSON.parse(app.steps || '[]');
  const stepTimesRows = db.prepare(`SELECT step_times FROM completions WHERE app_id=? AND status='completed' LIMIT 200`).all(appId);
  const stepSums = {};
  const stepCounts = {};
  for (const row of stepTimesRows) {
    const st = JSON.parse(row.step_times || '{}');
    for (const [idx, secs] of Object.entries(st)) {
      stepSums[idx] = (stepSums[idx] || 0) + Number(secs);
      stepCounts[idx] = (stepCounts[idx] || 0) + 1;
    }
  }
  const step_averages = steps.map((s, i) => ({
    index: i,
    name: s.name,
    avg_seconds: stepCounts[i] ? Math.round(stepSums[i] / stepCounts[i]) : 0,
    takt_seconds: s.takt_time_seconds || 0,
  }));

  res.json({
    app_id: appId, app_name: app.name,
    total, limit, page,
    avg_duration: stats?.avg_minutes ? Math.round(stats.avg_minutes * 10) / 10 : 0,
    best_time: stats?.best_minutes ? Math.round(stats.best_minutes * 10) / 10 : 0,
    pass_rate,
    trend,
    step_averages,
    items: rows.map(r => ({
      ...parseCompletion(r),
      work_order_number: r.work_order_number || null,
    })),
  });
});

module.exports = router;
