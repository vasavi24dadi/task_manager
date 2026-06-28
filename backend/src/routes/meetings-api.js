const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ============================================================================
// GET ALL MEETINGS
// ============================================================================
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT 
        m.id, m.title, m.description, m.organizer_id, m.meeting_type, 
        m.start_time, m.end_time, m.status, m.max_participants, m.created_at,
        u.name as organizer_name
      FROM meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      ORDER BY m.start_time DESC`,
    );

    const meetings = rows.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      organizerId: m.organizer_id,
      organizerName: m.organizer_name,
      meetingType: m.meeting_type,
      startTime: m.start_time,
      endTime: m.end_time,
      status: m.status,
      maxParticipants: m.max_participants,
      createdAt: m.created_at,
    }));

    res.json(meetings);
  } catch (err) {
    console.error('[GET_MEETINGS]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE MEETING
// ============================================================================
router.post('/', requireAuth, async (req, res) => {
  const pool = getPool();
  const { title, description, meetingType = 'video', startTime, participantIds = [] } = req.body;

  if (!title || !startTime) {
    return res.status(400).json({ error: 'Title and start time are required' });
  }

  try {
    const { rows: meetingRows } = await pool.query(
      `INSERT INTO meetings 
        (title, description, organizer_id, meeting_type, start_time, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING id, title, description, organizer_id, meeting_type, start_time`,
      [title, description || null, req.userId, meetingType, startTime, 'scheduled']
    );

    const meeting = meetingRows[0];

    // Add organizer as participant
    await pool.query(
      'INSERT INTO meeting_participants (meeting_id, user_id, status, joined_at) VALUES ($1, $2, $3, now())',
      [meeting.id, req.userId, 'joined']
    );

    // Add other participants
    for (const userId of participantIds) {
      if (userId !== req.userId) {
        await pool.query(
          'INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, $3)',
          [meeting.id, userId, 'invited']
        );

        // Create notification
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [userId, 'meeting_reminder', 'Meeting Invitation', `Meeting "${title}" scheduled`, 'meeting', meeting.id]
        );
      }
    }

    res.status(201).json({
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      organizerId: meeting.organizer_id,
      meetingType: meeting.meeting_type,
      startTime: meeting.start_time,
    });
  } catch (err) {
    console.error('[CREATE_MEETING]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// START MEETING (Generate WebRTC room)
// ============================================================================
router.post('/:id/start', requireAuth, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT organizer_id, status FROM meetings WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const meeting = rows[0];

    // Only organizer can start
    if (meeting.organizer_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Generate room ID for WebRTC
    const roomId = `room_${id}_${Date.now()}`;

    const { rows: updateRows } = await pool.query(
      'UPDATE meetings SET status = $1, meeting_url = $2, updated_at = now() WHERE id = $3 RETURNING *',
      ['in_progress', roomId, id]
    );

    res.json({
      roomId,
      status: 'in_progress',
    });
  } catch (err) {
    console.error('[START_MEETING]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// JOIN MEETING
// ============================================================================
router.post('/:id/join', requireAuth, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  try {
    const { rows: meetingRows } = await pool.query(
      'SELECT meeting_url FROM meetings WHERE id = $1',
      [id]
    );

    if (meetingRows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update participant status
    await pool.query(
      `UPDATE meeting_participants SET status = $1, joined_at = now() 
       WHERE meeting_id = $2 AND user_id = $3`,
      ['joined', id, req.userId]
    );

    res.json({
      roomId: meetingRows[0].meeting_url,
      joined: true,
    });
  } catch (err) {
    console.error('[JOIN_MEETING]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// END MEETING
// ============================================================================
router.post('/:id/end', requireAuth, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT organizer_id FROM meetings WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (rows[0].organizer_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query(
      'UPDATE meetings SET status = $1, end_time = now(), updated_at = now() WHERE id = $2',
      ['completed', id]
    );

    // Update all participants' left_at time
    await pool.query(
      'UPDATE meeting_participants SET left_at = now() WHERE meeting_id = $1',
      [id]
    );

    res.json({ message: 'Meeting ended' });
  } catch (err) {
    console.error('[END_MEETING]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CALL HISTORY
// ============================================================================
router.get('/calls/history', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT 
        ch.id, ch.caller_id, ch.callee_id, ch.call_type, ch.status,
        ch.started_at, ch.ended_at, ch.duration_seconds,
        u1.name as caller_name, u2.name as callee_name
      FROM call_history ch
      LEFT JOIN users u1 ON ch.caller_id = u1.id
      LEFT JOIN users u2 ON ch.callee_id = u2.id
      WHERE ch.caller_id = $1 OR ch.callee_id = $1
      ORDER BY ch.started_at DESC
      LIMIT 100`,
      [req.userId]
    );

    const calls = rows.map(c => ({
      id: c.id,
      callerId: c.caller_id,
      callerName: c.caller_name,
      calleeId: c.callee_id,
      calleeName: c.callee_name,
      callType: c.call_type,
      status: c.status,
      startedAt: c.started_at,
      endedAt: c.ended_at,
      durationSeconds: c.duration_seconds,
    }));

    res.json(calls);
  } catch (err) {
    console.error('[GET_CALL_HISTORY]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// LOG CALL
// ============================================================================
router.post('/calls/log', requireAuth, async (req, res) => {
  const pool = getPool();
  const { calleeId, callType, status, durationSeconds } = req.body;

  if (!calleeId || !callType) {
    return res.status(400).json({ error: 'Callee ID and call type are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO call_history 
        (caller_id, callee_id, call_type, status, started_at, ended_at, duration_seconds, created_at)
       VALUES ($1, $2, $3, $4, now(), now(), $5, now())
       RETURNING id, caller_id, callee_id, call_type, status, duration_seconds`,
      [req.userId, calleeId, callType, status || 'completed', durationSeconds || 0]
    );

    res.status(201).json({
      id: rows[0].id,
      callerId: rows[0].caller_id,
      calleeId: rows[0].callee_id,
      callType: rows[0].call_type,
      status: rows[0].status,
      durationSeconds: rows[0].duration_seconds,
    });
  } catch (err) {
    console.error('[LOG_CALL]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
