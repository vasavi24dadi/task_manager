const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ============================================================================
// GET ATTENDANCE REPORT
// ============================================================================
router.get('/attendance', requireAuth, requireRole('ADMIN', 'HR'), async (req, res) => {
  const pool = getPool();
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT 
        e.id, u.name, e.employee_number, e.department,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as days_present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as days_absent,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as days_late,
        COUNT(CASE WHEN a.status = 'leave' THEN 1 END) as days_leave,
        ROUND(AVG(a.hours_worked), 2) as avg_hours
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN attendance a ON e.id = a.employee_id
    `;

    const params = [];

    if (startDate || endDate) {
      query += ` WHERE`;
      if (startDate) {
        params.push(startDate);
        query += ` a.attendance_date >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += `${startDate ? ' AND' : ''} a.attendance_date <= $${params.length}`;
      }
    }

    query += ` GROUP BY e.id, u.name, e.employee_number, e.department ORDER BY u.name`;

    const { rows } = await pool.query(query, params);

    res.json({
      type: 'attendance',
      startDate,
      endDate,
      data: rows.map(r => ({
        employeeId: r.id,
        name: r.name,
        employeeNumber: r.employee_number,
        department: r.department,
        daysPresent: parseInt(r.days_present),
        daysAbsent: parseInt(r.days_absent),
        daysLate: parseInt(r.days_late),
        daysLeave: parseInt(r.days_leave),
        avgHours: parseFloat(r.avg_hours),
      })),
    });
  } catch (err) {
    console.error('[ATTENDANCE_REPORT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET TASK COMPLETION REPORT
// ============================================================================
router.get('/tasks', requireAuth, requireRole('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const pool = getPool();

  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as completion_rate
      FROM tasks
    `);

    const stats = rows[0];

    // Tasks by priority
    const { rows: priorityRows } = await pool.query(`
      SELECT priority, COUNT(*) as count, 
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM tasks
      GROUP BY priority
    `);

    // Tasks by employee
    const { rows: employeeRows } = await pool.query(`
      SELECT 
        e.id, u.name, COUNT(t.id) as assigned_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / COUNT(t.id), 2) as completion_rate
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN tasks t ON e.id = t.assigned_to_id
      WHERE t.id IS NOT NULL
      GROUP BY e.id, u.name
      ORDER BY completion_rate DESC
    `);

    res.json({
      type: 'tasks',
      summary: {
        totalTasks: parseInt(stats.total_tasks),
        completed: parseInt(stats.completed),
        inProgress: parseInt(stats.in_progress),
        pending: parseInt(stats.pending),
        blocked: parseInt(stats.blocked),
        completionRate: parseFloat(stats.completion_rate),
      },
      byPriority: priorityRows.map(r => ({
        priority: r.priority,
        total: parseInt(r.count),
        completed: parseInt(r.completed),
      })),
      byEmployee: employeeRows.map(r => ({
        employeeId: r.id,
        name: r.name,
        assigned: parseInt(r.assigned_tasks),
        completed: parseInt(r.completed),
        completionRate: parseFloat(r.completion_rate),
      })),
    });
  } catch (err) {
    console.error('[TASK_REPORT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET PROJECT REPORT
// ============================================================================
router.get('/projects', requireAuth, requireRole('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const pool = getPool();

  try {
    const { rows } = await pool.query(`
      SELECT 
        p.id, p.name, p.status, p.start_date, p.end_date,
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0), 2) as progress_percentage,
        u.name as owner_name
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN users u ON p.owner_id = u.id
      GROUP BY p.id, p.name, p.status, p.start_date, p.end_date, u.name
      ORDER BY p.created_at DESC
    `);

    const projects = rows.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      ownerName: r.owner_name,
      totalTasks: parseInt(r.total_tasks),
      completedTasks: parseInt(r.completed_tasks),
      progressPercentage: parseFloat(r.progress_percentage) || 0,
    }));

    res.json({
      type: 'projects',
      data: projects,
    });
  } catch (err) {
    console.error('[PROJECT_REPORT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET LEAVE REPORT
// ============================================================================
router.get('/leaves', requireAuth, requireRole('ADMIN', 'HR'), async (req, res) => {
  const pool = getPool();
  const { status = 'all' } = req.query;

  try {
    let query = `
      SELECT 
        l.id, u.name, e.employee_number, lt.name as leave_type,
        l.start_date, l.end_date, l.number_of_days, l.reason, l.status,
        u2.name as approved_by
      FROM leaves l
      LEFT JOIN employees e ON l.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
      LEFT JOIN users u2 ON l.approved_by_id = u2.id
    `;

    const params = [];

    if (status !== 'all') {
      query += ` WHERE l.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY l.start_date DESC`;

    const { rows } = await pool.query(query, params);

    const leaves = rows.map(r => ({
      id: r.id,
      employeeName: r.name,
      employeeNumber: r.employee_number,
      leaveType: r.leave_type,
      startDate: r.start_date,
      endDate: r.end_date,
      days: r.number_of_days,
      reason: r.reason,
      status: r.status,
      approvedBy: r.approved_by,
    }));

    res.json({
      type: 'leaves',
      status,
      data: leaves,
    });
  } catch (err) {
    console.error('[LEAVE_REPORT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET PERFORMANCE REPORT
// ============================================================================
router.get('/performance', requireAuth, requireRole('ADMIN', 'HR', 'MANAGER'), async (req, res) => {
  const pool = getPool();

  try {
    const { rows } = await pool.query(`
      SELECT 
        e.id, u.name, e.employee_number, e.department,
        AVG(pr.rating) as avg_rating,
        COUNT(pr.id) as review_count,
        MAX(pr.created_at) as last_review_date
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN performance_reviews pr ON e.id = pr.employee_id
      GROUP BY e.id, u.name, e.employee_number, e.department
      ORDER BY avg_rating DESC
    `);

    const performance = rows.map(r => ({
      employeeId: r.id,
      name: r.name,
      employeeNumber: r.employee_number,
      department: r.department,
      avgRating: parseFloat(r.avg_rating) || 0,
      reviewCount: parseInt(r.review_count),
      lastReviewDate: r.last_review_date,
    }));

    res.json({
      type: 'performance',
      data: performance,
    });
  } catch (err) {
    console.error('[PERFORMANCE_REPORT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// EXPORT REPORT (JSON/CSV)
// ============================================================================
router.get('/:reportType/export', requireAuth, requireRole('ADMIN', 'HR'), async (req, res) => {
  const { reportType } = req.params;
  const { format = 'json' } = req.query;

  try {
    // For CSV export, we can use a simple CSV formatter
    // This is a placeholder - implement actual export logic based on report type

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report_${reportType}_${Date.now()}.csv"`);
      // TODO: Implement CSV formatting
      res.json({ message: 'CSV export coming soon' });
    } else {
      res.json({ message: `Export for ${reportType} report` });
    }
  } catch (err) {
    console.error('[EXPORT_REPORT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
