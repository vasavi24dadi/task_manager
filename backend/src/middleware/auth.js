const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'replace_me_with_strong_secret';

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid authorization format' });
  const payload = verifyToken(parts[1]);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  req.userId = payload.sub;
  req.userRole = payload.role || payload.r || 'INTERN';
  // Optionally load user
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT id,name,email,role,status FROM users WHERE id=$1', [req.userId]);
    req.user = rows[0] || null;
  } catch (err) {
    console.warn('Failed to load user for auth middleware', err);
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.userRole || (req.user && req.user.role) || 'INTERN';
    if (allowedRoles.includes(role) || allowedRoles.includes('*')) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = { requireAuth, requireRole };
