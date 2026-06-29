const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ============================================================================
// GET NOTIFICATIONS
// ============================================================================
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();

  try {
    const { unread = false } = req.query;

    let query = `
      SELECT
        id,
        type,
        title,
        message,
        read,
        link_path,
        created_at
      FROM notifications
      WHERE user_id = $1
    `;

    const params = [req.userId];

    if (unread === 'true') {
      query += ` AND read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const { rows } = await pool.query(query, params);

    res.json(
      rows.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.read,
        actionUrl: n.link_path,
        createdAt: n.created_at,
      }))
    );
  } catch (err) {
    console.error('[GET_NOTIFICATIONS]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// UNREAD COUNT
// ============================================================================
router.get('/unread/count', requireAuth, async (req, res) => {
  const pool = getPool();

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS unread_count
       FROM notifications
       WHERE user_id = $1
       AND read = false`,
      [req.userId]
    );

    res.json({
      unreadCount: Number(rows[0].unread_count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// MARK READ
// ============================================================================
router.put('/:id/read', requireAuth, async (req, res) => {
  const pool = getPool();

  try {
    const { rows } = await pool.query(
      `UPDATE notifications
       SET read = true
       WHERE id=$1
       AND user_id=$2
       RETURNING id,read`,
      [req.params.id, req.userId]
    );

    if (!rows.length)
      return res.status(404).json({ error: 'Notification not found' });

    res.json({
      id: rows[0].id,
      isRead: rows[0].read
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// MARK ALL READ
// ============================================================================
router.put('/read/all', requireAuth, async (req, res) => {
  const pool = getPool();

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET read=true
       WHERE user_id=$1
       AND read=false`,
      [req.userId]
    );

    res.json({
      markedCount: result.rowCount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// DELETE
// ============================================================================
router.delete('/:id', requireAuth, async (req, res) => {
  const pool = getPool();

  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id=$1
       AND user_id=$2`,
      [req.params.id, req.userId]
    );

    if (!result.rowCount)
      return res.status(404).json({ error: 'Notification not found' });

    res.json({ message: 'Deleted' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE
// ============================================================================
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const pool = getPool();

  const {
    userId,
    type,
    title,
    message,
    linkPath
  } = req.body;

  try {

    const { rows } = await pool.query(
      `INSERT INTO notifications
      (user_id,title,message,type,read,link_path)
      VALUES($1,$2,$3,$4,false,$5)
      RETURNING *`,
      [
        userId,
        title,
        message,
        type,
        linkPath || null
      ]
    );

    res.status(201).json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;