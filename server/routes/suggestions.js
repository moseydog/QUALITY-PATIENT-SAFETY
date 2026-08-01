const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, metric_key, text FROM suggestions ORDER BY metric_key, id').all();
  const byMetric = {};
  rows.forEach((r) => {
    if (!byMetric[r.metric_key]) byMetric[r.metric_key] = [];
    byMetric[r.metric_key].push({ id: r.id, text: r.text });
  });
  res.json(byMetric);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { metric_key, text } = req.body || {};
  if (!metric_key || !text || !text.trim()) {
    return res.status(400).json({ error: 'A metric and suggestion text are required' });
  }
  const info = db.prepare('INSERT INTO suggestions (metric_key, text) VALUES (?, ?)').run(metric_key, text.trim());
  res.json({ id: info.lastInsertRowid });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
