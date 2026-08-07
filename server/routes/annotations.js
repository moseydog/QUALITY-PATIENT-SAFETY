const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware');

const router = express.Router();
router.use(requireAuth);

const SCOPES = ['all', 'fall', 'hapi', 'education'];
const KINDS = ['staffing', 'intervention', 'process', 'external', 'other'];
const MONTH_RE = /^\d{4}-\d{2}$/;

function validate(b) {
  if (!b.title || !String(b.title).trim()) return 'A title is required';
  if (!MONTH_RE.test(b.start_month || '')) return 'Start month must look like 2026-01';
  if (!MONTH_RE.test(b.end_month || '')) return 'End month must look like 2026-04';
  if (b.end_month < b.start_month) return 'End month cannot be before start month';
  if (b.scope && !SCOPES.includes(b.scope)) return 'Unknown scope';
  if (b.kind && !KINDS.includes(b.kind)) return 'Unknown kind';
  return null;
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM annotations ORDER BY start_month, id').all();
  res.json(rows);
});

router.post('/', requireRole('admin'), (req, res) => {
  const b = req.body || {};
  const err = validate(b);
  if (err) return res.status(400).json({ error: err });
  const info = db.prepare(
    'INSERT INTO annotations (start_month, end_month, scope, kind, title, detail) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(b.start_month, b.end_month, b.scope || 'all', b.kind || 'other', String(b.title).trim(), b.detail || null);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const b = req.body || {};
  const err = validate(b);
  if (err) return res.status(400).json({ error: err });
  const existing = db.prepare('SELECT id FROM annotations WHERE id = ?').get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'No such annotation' });
  db.prepare(
    'UPDATE annotations SET start_month=?, end_month=?, scope=?, kind=?, title=?, detail=? WHERE id=?'
  ).run(b.start_month, b.end_month, b.scope || 'all', b.kind || 'other', String(b.title).trim(), b.detail || null, Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM annotations WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
