const express = require('express');
const db = require('../db');

const router = express.Router();

// ─── GET / — all company settings ────────────────────────────────────────────

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM company_settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// ─── PUT / — bulk update settings ─────────────────────────────────────────────

router.put('/', (req, res) => {
  const ins = db.prepare(`INSERT INTO company_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);
  const upsertAll = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'undefined') ins.run(key, String(value));
    }
  });
  upsertAll(req.body);
  const rows = db.prepare('SELECT key, value FROM company_settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// ─── GET /plan — plan info + usage stats ─────────────────────────────────────

router.get('/plan', (req, res) => {
  let plan = db.prepare('SELECT * FROM plan WHERE id = 1').get();
  if (!plan) {
    db.prepare(`INSERT INTO plan (id, tier, app_limit, dashboard_limit) VALUES (1, 'free', 3, 2)`).run();
    plan = db.prepare('SELECT * FROM plan WHERE id = 1').get();
  }
  const app_count       = db.prepare('SELECT COUNT(*) as c FROM apps').get().c;
  const dashboard_count = db.prepare('SELECT COUNT(*) as c FROM dashboards').get().c;
  const completion_count= db.prepare('SELECT COUNT(*) as c FROM completions').get().c;

  const features = {
    free: ['App Builder (3 apps)', 'Work Orders', 'OEE Tracking', 'Basic Analytics', 'Operator Portal'],
    pro:  ['Unlimited Apps', 'Unlimited Dashboards', 'Inventory Management', 'Purchasing & Vendors', 'Quality / NCR Management', 'Data Export (CSV/JSON)', 'Advanced Analytics', 'Priority Support'],
    enterprise: ['Everything in Pro', 'Custom Branding', 'SSO / SAML', 'Dedicated Instance', 'SLA Guarantee', 'API Access', 'Custom Integrations'],
  };

  res.json({
    ...plan,
    app_count,
    dashboard_count,
    completion_count,
    features: features[plan.tier] || features.free,
    all_features: features,
  });
});

// ─── PUT /plan — update plan tier (demo: free toggle) ────────────────────────

router.put('/plan', (req, res) => {
  const { tier, app_limit, dashboard_limit } = req.body;
  const validTiers = ['free', 'pro', 'enterprise'];
  if (tier && !validTiers.includes(tier)) return res.status(400).json({ error: `tier must be one of: ${validTiers.join(', ')}` });

  const defaults = { free: [3, 2], pro: [-1, -1], enterprise: [-1, -1] };
  const [defAppLimit, defDashLimit] = defaults[tier || 'free'];

  db.prepare(`
    INSERT INTO plan (id, tier, app_limit, dashboard_limit, updated_at) VALUES (1, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET tier=excluded.tier, app_limit=excluded.app_limit, dashboard_limit=excluded.dashboard_limit, updated_at=excluded.updated_at
  `).run(
    tier || 'free',
    app_limit !== undefined ? app_limit : defAppLimit,
    dashboard_limit !== undefined ? dashboard_limit : defDashLimit
  );

  res.json(db.prepare('SELECT * FROM plan WHERE id = 1').get());
});

module.exports = router;
