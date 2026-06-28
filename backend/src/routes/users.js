const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ============================================================================
// GET ALL USERS (Admin only)
// ============================================================================
router.get('/', requireAuth, requireRole('ADMIN', 'HR'), async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, u.last_login, r.name as role, r.id as role_id
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    
    const users = rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleId: u.role_id,
      status: u.status,
      avatarUrl: u.avatar_url,
      lastLogin: u.last_login,
      createdAt: u.created_at,
    }));
    
    res.json(users);
  } catch (err) {
    console.error('[GET_USERS]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET USER BY ID
// ============================================================================
router.get('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, u.phone, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 LIMIT 1`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    
    // Allow users to view their own profile or admins to view any profile
    if (req.userId !== user.id && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('[GET_USER]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE USER (Admin/HR only)
// ============================================================================
router.post('/', requireAuth, requireRole('ADMIN', 'HR'), async (req, res) => {
  const { name, email, password, roleId, status } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const pool = getPool();
  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Verify role exists
    let finalRoleId = roleId;
    if (!finalRoleId) {
      const { rows } = await pool.query('SELECT id FROM roles WHERE name = $1', ['INTERN']);
      finalRoleId = rows[0]?.id;
    }

    if (!finalRoleId) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, name, email, status, avatar_url, created_at`,
      [name || 'User', email, passwordHash, finalRoleId, status || 'active']
    );

    if (rows.length === 0) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const user = rows[0];
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [req.userId, 'create_user', 'user', user.id]
    );

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('[CREATE_USER]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// UPDATE USER (Admin only, or self)
// ============================================================================
router.put('/:id', requireAuth, async (req, res) => {
  const userId = req.params.id;
  const { name, email, role, status, phone, avatarUrl, password } = req.body;

  // Only admins can update other users, users can only update themselves
  if (req.userId !== userId && req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const pool = getPool();
  try {
    // Build dynamic update query
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }

    if (email !== undefined && req.userRole === 'ADMIN') {
      fields.push(`email = $${idx++}`);
      values.push(email);
    }

    if (role && req.userRole === 'ADMIN') {
      // Get role ID from role name
      const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
      if (roleRes.rowCount > 0) {
        fields.push(`role_id = $${idx++}`);
        values.push(roleRes.rows[0].id);
      }
    }

    if (status !== undefined && req.userRole === 'ADMIN') {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }

    if (phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(phone);
    }

    if (avatarUrl !== undefined) {
      fields.push(`avatar_url = $${idx++}`);
      values.push(avatarUrl);
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = now() 
                 WHERE id = $${idx} 
                 RETURNING id, name, email, status, avatar_url, created_at`;

    const { rows } = await pool.query(sql, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      status: rows[0].status,
      avatarUrl: rows[0].avatar_url,
      createdAt: rows[0].created_at,
    });
  } catch (err) {
    console.error('[UPDATE_USER]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// DELETE USER (Admin only)
// ============================================================================
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const userId = req.params.id;

  if (userId === req.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const pool = getPool();
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [req.userId, 'delete_user', 'user', userId]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('[DELETE_USER]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
