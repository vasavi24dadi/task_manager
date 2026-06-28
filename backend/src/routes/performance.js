const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

async function resolveEmployeeId(pool, userId) {
  const { rows } = await pool.query('SELECT id FROM employees WHERE user_id = $1 LIMIT 1', [userId]);
  return rows[0]?.id || null;
}

router.get('/user/:userId', async (req, res) => {
  const pool = getPool();
  const employeeId = await resolveEmployeeId(pool, req.params.userId);
  if (!employeeId) return res.status(404).json({ error: 'Employee not found' });
  const { rows } = await pool.query('SELECT id, employee_id, score, period, notes, created_by, created_at FROM performance_scores WHERE employee_id=$1 ORDER BY created_at DESC', [employeeId]);
  res.json(rows.map(r => ({ id: r.id, employeeId: r.employee_id, score: r.score, period: r.period, notes: r.notes, createdBy: r.created_by, createdAt: r.created_at })));
});

router.post('/user/:userId', async (req, res) => {
  const pool = getPool();
  const employeeId = await resolveEmployeeId(pool, req.params.userId);
  if (!employeeId) return res.status(404).json({ error: 'Employee not found' });
  const { score, period, notes, createdBy } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO performance_scores (employee_id, score, period, notes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id, employee_id, score, period, notes, created_by, created_at',
    [employeeId, score, period, notes, createdBy || null]
  );
  res.status(201).json(rows[0]);
});

router.get('/leaderboard', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT e.user_id AS user_id, u.name AS name, AVG(p.score) AS avg_score
     FROM performance_scores p
     JOIN employees e ON e.id = p.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     GROUP BY e.user_id, u.name
     ORDER BY avg_score DESC
     LIMIT 20`
  );
  res.json(rows.map(r => ({ userId: r.user_id, name: r.name, score: Number(r.avg_score) })));
});

module.exports = router;
