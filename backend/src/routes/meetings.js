const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get all meetings for current user
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.name as host_name,
        (SELECT json_agg(mp.user_id) FROM meeting_participants mp WHERE mp.meeting_id = m.id) as participants
       FROM meetings m
       LEFT JOIN users u ON u.id = m.host_id
       ORDER BY m.start_time ASC`
    );
    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      startTime: r.start_time,
      endTime: r.end_time,
      hostId: r.host_id,
      hostName: r.host_name,
      meetingLink: r.meeting_link,
      status: r.status,
      participants: r.participants || [],
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Error fetching meetings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a meeting
router.post('/', requireAuth, async (req, res) => {
  const { title, description, startTime, endTime, meetingLink } = req.body;
  if (!title || !startTime || !endTime) {
    return res.status(400).json({ error: 'Title, startTime, and endTime are required' });
  }
  const pool = getPool();
  try {
    const link = meetingLink || `https://meet.jit.si/${encodeURIComponent(title.replace(/\s+/g, '-'))}-${Date.now()}`;
    const { rows } = await pool.query(
      'INSERT INTO meetings (title, description, start_time, end_time, host_id, meeting_link, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, description || null, startTime, endTime, req.userId, link, 'scheduled']
    );
    const meeting = rows[0];

    // Auto add host as participant
    await pool.query('INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2)', [meeting.id, req.userId]);

    res.status(201).json(meeting);
  } catch (err) {
    console.error('Error creating meeting:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a meeting
router.post('/:id/join', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    await pool.query(
      'INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error joining meeting:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
