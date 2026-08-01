const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, role, display_name } = req.body || {};
  if (!username || !password || !['volunteer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Username, password, and a valid role are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: 'That username is already taken' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
  ).run(username, hash, role, display_name || username);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: "You can't remove your own account while logged in as it" });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
