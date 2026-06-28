const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ============================================================================
// GET NOTIFICATIONS FOR CURRENT USER
// ============================================================================
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { unread = false } = req.query;

    let query = `
      SELECT 
        id, type, title, message, related_entity_type, related_entity_id,
        related_user_id, is_read, read_at, action_url, metadata, created_at
      FROM notifications
      WHERE user_id = $1
    `;

    const params = [req.userId];

    if (unread === 'true') {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const { rows } = await pool.query(query, params);

    const notifications = rows.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      relatedEntityType: n.related_entity_type,
      relatedEntityId: n.related_entity_id,
      relatedUserId: n.related_user_id,
      isRead: n.is_read,
      readAt: n.read_at,
      actionUrl: n.action_url,
      metadata: n.metadata,
      createdAt: n.created_at,
    }));

    res.json(notifications);
  } catch (err) {
    console.error('[GET_NOTIFICATIONS]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET UNREAD COUNT
// ============================================================================
router.get('/unread/count', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.userId]
    );

    res.json({ unreadCount: parseInt(rows[0].unread_count) });
  } catch (err) {
    console.error('[UNREAD_COUNT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// MARK NOTIFICATION AS READ
// ============================================================================
router.put('/:id/read', requireAuth, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1 AND user_id = $2 RETURNING id, is_read, read_at',
      [id, req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      id: rows[0].id,
      isRead: rows[0].is_read,
      readAt: rows[0].read_at,
    });
  } catch (err) {
    console.error('[MARK_READ]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================================
router.put('/read/all', requireAuth, async (req, res) => {
  const pool = getPool();

  try {
    const { rowCount } = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND is_read = false',
      [req.userId]
    );

    res.json({ markedCount: rowCount });
  } catch (err) {
    console.error('[MARK_ALL_READ]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// DELETE NOTIFICATION
// ============================================================================
router.delete('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('[DELETE_NOTIFICATION]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE NOTIFICATION (Admin/System only)
// ============================================================================
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const pool = getPool();
  const { userId, type, title, message, relatedEntityType, relatedEntityId } = req.body;

  if (!userId || !type || !title) {
    return res.status(400).json({ error: 'User ID, type, and title are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications 
        (user_id, type, title, message, related_entity_type, related_entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id, type, title, message, created_at`,
      [userId, type, title, message || null, relatedEntityType || null, relatedEntityId || null]
    );

    res.status(201).json({
      id: rows[0].id,
      type: rows[0].type,
      title: rows[0].title,
      message: rows[0].message,
      createdAt: rows[0].created_at,
    });
  } catch (err) {
    console.error('[CREATE_NOTIFICATION]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
