const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

// GET ATTENDANCE
router.get('/:userId', async (req, res) => {
  const pool = getPool();

  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM attendance
       WHERE user_id=$1
       ORDER BY created_at DESC`,
      [req.params.userId]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE ATTENDANCE
router.post('/', async (req, res) => {
  const pool = getPool();

  const {
    userId,
    attendanceDate,
    checkIn,
    checkOut,
    hours,
    status
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO attendance
      (
        user_id,
        attendance_date,
        check_in,
        check_out,
        hours,
        status
      )
      VALUES($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [
        userId,
        attendanceDate || new Date(),
        checkIn || null,
        checkOut || null,
        hours || null,
        status || null
      ]
    );

    res.status(201).json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE ATTENDANCE
router.put('/:id', async (req, res) => {
  const pool = getPool();

  const { checkOut, hours, status } = req.body;

  try {

    const { rows } = await pool.query(
      `UPDATE attendance
      SET
      check_out=$1,
      hours=$2,
      status=$3
      WHERE id=$4
      RETURNING *`,
      [
        checkOut,
        hours,
        status,
        req.params.id
      ]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;