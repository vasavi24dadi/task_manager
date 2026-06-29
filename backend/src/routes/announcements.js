const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, title, message, created_by, created_at FROM announcements ORDER BY created_at DESC');
  res.json(rows.map(r => ({ id: r.id, title: r.title, message: r.message, createdBy: r.created_by, createdAt: r.created_at })));
});

router.post('/', requireAuth, requireRole('ADMIN', 'HR'), async (req, res) => {
  const pool = getPool();
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  const { rows } = await pool.query(
    'INSERT INTO announcements (title, message, created_by) VALUES ($1,$2,$3) RETURNING id, title, message, created_by, created_at',
    [title, message, req.userId]
  );

  const announcement = rows[0];
  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE id != $1', [req.userId]);

  for (const user of userRows) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [user.id, 'announcement', 'New announcement', title, 'announcement', announcement.id]
    );
  }

  res.status(201).json(announcement);
});

module.exports = router;
