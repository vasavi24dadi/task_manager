const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Apply for Leave (Intern / User)
router.post('/', requireAuth, async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required' });
  }
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'INSERT INTO leaves (user_id, start_date, end_date, reason, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, startDate, endDate, reason || null, 'pending']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error applying for leave:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// View Leaves (HR gets all, others get their own)
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    let query = 'SELECT l.*, u.name as user_name, u.email as user_email FROM leaves l JOIN users u ON u.id = l.user_id';
    let params = [];
    
    if (req.userRole !== 'HR' && req.userRole !== 'ADMIN') {
      query += ' WHERE l.user_id = $1';
      params.push(req.userId);
    }
    
    query += ' ORDER BY l.created_at DESC';
    const { rows } = await pool.query(query, params);
    
    res.json(rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      startDate: r.start_date,
      endDate: r.end_date,
      reason: r.reason,
      status: r.status,
      approvedBy: r.approved_by,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Error fetching leaves:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve / Reject Leave Request (HR / Admin only)
router.put('/:id', requireAuth, requireRole('HR', 'ADMIN'), async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid leave status' });
  }
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'UPDATE leaves SET status = $1, approved_by = $2 WHERE id = $3 RETURNING *',
      [status, req.userId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Leave request not found' });

    const updated = rows[0];
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [updated.user_id, 'leave_status', 'Leave request updated', `Your leave request was ${status}.`, 'leave', updated.id]
    );

    res.json(updated);
  } catch (err) {
    console.error('Error updating leave request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
