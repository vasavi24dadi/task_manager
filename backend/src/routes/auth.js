const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_me_with_strong_secret';
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

function mapUserResponse(user, role) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: role,
    status: user.status,
    avatarUrl: user.avatar_url,
    createdAt: user.created_at,
    lastLogin: user.last_login,
  };
}

// ============================================================================
// REGISTER
// ============================================================================
router.post('/register', async (req, res) => {
  const { name, email, password, role: requestedRole } = req.body;
  const role = (requestedRole || 'INTERN').toString().trim().toUpperCase();
  const allowedRoles = ['INTERN', 'EMPLOYEE', 'HR', 'MANAGER'];

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected' });
  }

  const pool = getPool();
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const resolvedRoleName = role === 'EMPLOYEE' ? 'INTERN' : role;
    const roleRes = await pool.query('SELECT id, name FROM roles WHERE name=$1', [resolvedRoleName]);
    const roleRow = roleRes.rows[0];
    if (!roleRow) {
      return res.status(400).json({ error: 'Selected role is not available' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, now()) 
       RETURNING id, name, email, status, avatar_url, created_at, last_login`,
      [name || 'User', email, passwordHash, roleRow.id, 'pending']
    );
    
    if (rows.length === 0) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const user = rows[0];
    
    return res.status(201).json({ 
      user: mapUserResponse(user, roleRow.name),
      requiresApproval: true,
      message: 'Thanks for signing up! Your account is under review. You\'ll receive access once an administrator approves your request.'
    });
  } catch (err) {
    console.error('[REGISTER]', err.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// LOGIN
// ============================================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const pool = getPool();
  try {
    const { rows: userRows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.status, u.avatar_url, u.created_at, u.last_login, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 LIMIT 1`,
      [email]
    );

    const user = userRows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const normalizedStatus = String(user.status || '').trim().toLowerCase();
    if (normalizedStatus === 'pending') {
      return res.status(403).json({
        error: 'Your account is under review. Please wait until an administrator approves your request.',
        requiresApproval: true,
      });
    }

    if (normalizedStatus !== 'active') {
      return res.status(401).json({ error: 'User account is not active' });
    }
    
    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = now() WHERE id = $1', [user.id]);
    
    const token = signToken({ sub: user.id, role: user.role || 'INTERN' });
    
    return res.json({ 
      user: mapUserResponse(user, user.role || 'INTERN'), 
      token 
    });
  } catch (err) {
    console.error('[LOGIN]', err.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// LOGOUT (stateless - client removes token)
// ============================================================================
router.post('/logout', requireAuth, (req, res) => {
  // Stateless JWT - just acknowledge logout
  // Client should remove the token
  return res.json({ message: 'Logged out successfully' });
});

// ============================================================================
// GET CURRENT USER
// ============================================================================
router.get('/me', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, u.last_login, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    return res.json({ user: mapUserResponse(user, user.role || 'INTERN') });
  } catch (err) {
    console.error('[GET_ME]', err.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CHANGE PASSWORD
// ============================================================================
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash || '');
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('[CHANGE_PASSWORD]', err.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
