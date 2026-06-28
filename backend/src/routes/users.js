const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getPool } = require('../db');

router.get('/', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, name, email, role, status, avatar_url, created_at FROM users ORDER BY created_at DESC');
  res.json(rows.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, avatarUrl: r.avatar_url, createdAt: r.created_at })));
});

router.get('/:id', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, name, email, role, status, avatar_url, created_at FROM users WHERE id=$1 LIMIT 1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const user = rows[0];
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, avatarUrl: user.avatar_url, createdAt: user.created_at });
});

router.post('/', async (req, res) => {
  const pool = getPool();
  const { name, email, role, status, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, status) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, status, avatar_url, created_at',
    [name || null, email, passwordHash, role || 'EMPLOYEE', status || 'active']
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const pool = getPool();
  const id = req.params.id;
  const { name, email, role, status, password, avatarUrl } = req.body;
  const fields = [];
  const vals = [];
  let idx = 1;
  if (name) { fields.push(`name=$${idx++}`); vals.push(name); }
  if (email) { fields.push(`email=$${idx++}`); vals.push(email); }
  if (role) { fields.push(`role=$${idx++}`); vals.push(role); }
  if (status) { fields.push(`status=$${idx++}`); vals.push(status); }
  if (avatarUrl) { fields.push(`avatar_url=$${idx++}`); vals.push(avatarUrl); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    fields.push(`password_hash=$${idx++}`);
    vals.push(hash);
  }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  vals.push(id);
  const sql = `UPDATE users SET ${fields.join(',')} WHERE id=$${idx} RETURNING id, name, email, role, status, avatar_url, created_at`;
  const { rows } = await pool.query(sql, vals);
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const pool = getPool();
  const id = req.params.id;
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ ok: true });
});

module.exports = router;
