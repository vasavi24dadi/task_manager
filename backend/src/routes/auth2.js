const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_me_with_strong_secret';
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  const pool = getPool();
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query('INSERT INTO users (name,email,password_hash,role,status) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,status,created_at', [name || null, email, hash, role || 'EMPLOYEE', 'active']);
    const user = rows[0];
    await pool.query('INSERT INTO employees (user_id, employee_number, position, department) SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM employees WHERE user_id=$1)', [user.id, `EMP-${Date.now() % 100000}`, null, null]);
    const token = signToken({ sub: user.id, role: user.role });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT id,name,email,role,password_hash,status,created_at FROM users WHERE email=$1 LIMIT 1', [email]);
    const user = rows[0];
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ sub: user.id, role: user.role });
    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
