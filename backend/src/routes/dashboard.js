const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const totalEmployeesRes = await pool.query('SELECT COUNT(*)::int AS total FROM employees WHERE status = $1', ['active']);
    const presentRes = await pool.query('SELECT COUNT(DISTINCT employee_id)::int AS present FROM attendance WHERE attendance_date = CURRENT_DATE AND check_in IS NOT NULL');
    const pendingTasksRes = await pool.query("SELECT COUNT(*)::int AS pending FROM tasks WHERE status != 'completed'");
    const completedTasksRes = await pool.query("SELECT COUNT(*)::int AS completed FROM tasks WHERE status = 'completed'");
    const perfRes = await pool.query('SELECT AVG(score)::numeric(10,2) AS avg_score FROM performance_scores');
    res.json({
      totalEmployees: totalEmployeesRes.rows[0].total || 0,
      presentToday: presentRes.rows[0].present || 0,
      pendingTasks: pendingTasksRes.rows[0].pending || 0,
      completedTasks: completedTasksRes.rows[0].completed || 0,
      averagePerformance: Number(perfRes.rows[0].avg_score) || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
