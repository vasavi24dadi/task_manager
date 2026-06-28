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
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const pool = getPool();
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Default registration to INTERN role
    const roleName = (role || 'INTERN').toUpperCase();
    const roleRes = await pool.query('SELECT id FROM roles WHERE name=$1', [roleName]);
    const roleId = roleRes.rows[0]?.id || null;

    if (!roleId) {
      return res.status(400).json({ error: `Invalid role specified: ${roleName}` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role_id, status) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, status, avatar_url, created_at',
      [name || null, email, passwordHash, roleId, 'active']
    );
    const user = rows[0];

    const token = signToken({ sub: user.id, role: user.role });
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, password_hash, status, avatar_url, created_at FROM users WHERE email=$1 LIMIT 1',
      [email]
    );
    const user = rows[0];
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    delete user.password_hash;
    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
