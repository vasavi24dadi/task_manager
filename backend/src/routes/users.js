const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function resolveRoleId(pool, roleName) {
  const normalized = String(roleName || 'INTERN').trim().toUpperCase();
  const candidates = normalized === 'EMPLOYEE' ? ['INTERN', 'EMPLOYEE'] : [normalized];

  for (const candidate of candidates) {
    const roleRes = await pool.query('SELECT id, name FROM roles WHERE name = $1', [candidate]);
    if (roleRes.rowCount > 0) {
      return { id: roleRes.rows[0].id, name: roleRes.rows[0].name };
    }
  }

  return null;
}

// ============================================================================
// GET ALL USERS (Admin only)
// ============================================================================
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, u.last_login, r.name as role, r.id as role_id
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );

    const roleFilter = String(req.query.role || '').trim().toUpperCase();
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const searchFilter = String(req.query.search || '').trim().toLowerCase();

    const users = rows
      .filter((u) => {
        const roleMatch = !roleFilter || String(u.role || '').toUpperCase() === roleFilter || (roleFilter === 'EMPLOYEE' && String(u.role || '').toUpperCase() === 'INTERN');
        const statusMatch = !statusFilter || String(u.status || '').toLowerCase() === statusFilter;
        const searchMatch = !searchFilter || `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(searchFilter);
        return roleMatch && statusMatch && searchMatch;
      })
      .map(u => ({
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
// PENDING REQUESTS / PASSWORD RESET / DELETE USER
// ============================================================================
router.get('/pending', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.created_at, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.status = 'pending'
       ORDER BY u.created_at DESC`
    );
    res.json(rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
    })));
  } catch (err) {
    console.error('[GET_PENDING_USERS]', err);
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
// CREATE USER (Admin only)
// ============================================================================
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  let { name, email, password, roleId, status } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  password = password || 'welcome123';
  const generatedPassword = password === 'welcome123' ? 'Welcome123!' : password;

  const pool = getPool();

  try {
    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    if (!roleId && req.body.role) {
      const resolvedRole = await resolveRoleId(pool, req.body.role);
      roleId = resolvedRole?.id;
    }

    if (!roleId) {
      const resolvedRole = await resolveRoleId(pool, 'INTERN');
      roleId = resolvedRole?.id;
    }

    if (!roleId) {
      return res.status(400).json({ error: 'Role not found' });
    }

    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    const { rows } = await pool.query(
      `INSERT INTO users
      (name,email,password_hash,role_id,status,created_at)
      VALUES($1,$2,$3,$4,$5,now())
      RETURNING id,name,email,status,avatar_url,created_at`,
      [
        name || 'User',
        email,
        passwordHash,
        roleId,
        status || 'active'
      ]
    );

    res.status(201).json({
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      status: rows[0].status,
      avatarUrl: rows[0].avatar_url,
      createdAt: rows[0].created_at,
      temporaryPassword: generatedPassword
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
      const resolvedRole = await resolveRoleId(pool, role);
      if (resolvedRole?.id) {
        fields.push(`role_id = $${idx++}`);
        values.push(resolvedRole.id);
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
// PENDING REQUESTS / PASSWORD RESET / DELETE USER
// ============================================================================
router.get('/pending', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.created_at, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.status = 'pending'
       ORDER BY u.created_at DESC`
    );
    res.json(rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
    })));
  } catch (err) {
    console.error('[GET_PENDING_USERS]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/pending/:id/approve', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  try {
    const { rowCount } = await pool.query(
      `UPDATE users SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'pending'`,
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Pending user not found' });
    }
    res.json({ message: 'User approved successfully' });
  } catch (err) {
    console.error('[APPROVE_USER]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/pending/:id/reject', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  try {
    const { rowCount } = await pool.query(
      `UPDATE users SET status = 'rejected', updated_at = now() WHERE id = $1 AND status = 'pending'`,
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Pending user not found' });
    }
    res.json({ message: 'User rejected successfully' });
  } catch (err) {
    console.error('[REJECT_USER]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/reset-password', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const newPassword = req.body.password || 'Welcome123!';
  const pool = getPool();
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const { rowCount } = await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ temporaryPassword: newPassword });
  } catch (err) {
    console.error('[RESET_PASSWORD]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
