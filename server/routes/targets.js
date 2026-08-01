const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM targets').all();
  const targets = {};
  rows.forEach((r) => { targets[r.metric_key] = r.target_value; });
  res.json(targets);
});

router.put('/:key', requireRole('admin'), (req, res) => {
  const value = Number(req.body && req.body.value);
  if (Number.isNaN(value) || value < 0 || value > 100) {
    return res.status(400).json({ error: 'Target must be a number between 0 and 100' });
  }
  db.prepare(
    `INSERT INTO targets (metric_key, target_value) VALUES (?, ?)
     ON CONFLICT(metric_key) DO UPDATE SET target_value = excluded.target_value`
  ).run(req.params.key, value);
  res.json({ ok: true });
});

module.exports = router;
