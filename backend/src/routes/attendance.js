const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

async function resolveEmployeeId(pool, userId) {
  const { rows } = await pool.query('SELECT id FROM employees WHERE user_id = $1 LIMIT 1', [userId]);
  return rows[0]?.id || null;
}

router.get('/:userId', async (req, res) => {
  const pool = getPool();
  const employeeId = await resolveEmployeeId(pool, req.params.userId);
  if (!employeeId) return res.status(404).json({ error: 'Employee not found' });
  const { rows } = await pool.query('SELECT id, employee_id, attendance_date, check_in, check_out, hours, status, created_at FROM attendance WHERE employee_id = $1 ORDER BY created_at DESC', [employeeId]);
  res.json(rows.map(r => ({ id: r.id, userId: req.params.userId, employeeId: r.employee_id, attendanceDate: r.attendance_date, checkIn: r.check_in, checkOut: r.check_out, hours: r.hours, status: r.status, createdAt: r.created_at })));
});

router.post('/', async (req, res) => {
  const pool = getPool();
  const { userId, employeeId, attendanceDate, checkIn, checkOut, hours, status } = req.body;
  const resolvedEmployeeId = employeeId || (userId ? await resolveEmployeeId(pool, userId) : null);
  if (!resolvedEmployeeId) return res.status(400).json({ error: 'Employee ID or user ID is required' });
  const { rows } = await pool.query(
    'INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, hours, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, employee_id, attendance_date, check_in, check_out, hours, status, created_at',
    [resolvedEmployeeId, attendanceDate || new Date(), checkIn || null, checkOut || null, hours || null, status || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const pool = getPool();
  const id = req.params.id;
  const { checkOut, hours, status } = req.body;
  const fields = [];
  const vals = [];
  let idx = 1;
  if (checkOut !== undefined) { fields.push(`check_out=$${idx++}`); vals.push(checkOut); }
  if (hours !== undefined) { fields.push(`hours=$${idx++}`); vals.push(hours); }
  if (status !== undefined) { fields.push(`status=$${idx++}`); vals.push(status); }
  if (!fields.length) return res.status(400).json({ error: 'No updatable fields' });
  vals.push(id);
  const sql = `UPDATE attendance SET ${fields.join(',')} WHERE id=$${idx} RETURNING id, employee_id, attendance_date, check_in, check_out, hours, status, created_at`;
  const { rows } = await pool.query(sql, vals);
  res.json(rows[0]);
});

module.exports = router;
