const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ============================================================================
// GET ALL TASKS (with role-based filtering)
// ============================================================================
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    let query = `
      SELECT 
        t.id, t.title, t.description, t.project_id, t.assigned_to_id, 
        t.created_by_id, t.status, t.priority, t.due_date, t.completion_percentage,
        t.created_at, t.updated_at,
        e.user_id as assigned_user_id,
        u.name as assigned_name
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
    `;

    const params = [];

    // Role-based filtering
    if (req.userRole === 'INTERN') {
      // Interns only see tasks assigned to them
      query += ` WHERE t.assigned_to_id IN (SELECT id FROM employees WHERE user_id = $1)`;
      params.push(req.userId);
    } else if (req.userRole === 'MANAGER') {
      // Managers see tasks in their team
      query += ` WHERE t.created_by_id = $1 OR t.assigned_to_id IN (
        SELECT id FROM employees WHERE manager_id IN (SELECT id FROM employees WHERE user_id = $1)
      )`;
      params.push(req.userId);
    }
    // ADMIN and HR see all tasks

    query += ` ORDER BY t.due_date ASC, t.priority DESC`;

    const { rows } = await pool.query(query, params);
    
    const tasks = rows.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      projectId: t.project_id,
      assignedTo: t.assigned_to_id,
      assignedName: t.assigned_name,
      createdBy: t.created_by_id,
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
      completionPercentage: t.completion_percentage,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    res.json(tasks);
  } catch (err) {
    console.error('[GET_TASKS]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET TASK BY ID
// ============================================================================
router.get('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT 
        t.id, t.title, t.description, t.project_id, t.assigned_to_id, 
        t.created_by_id, t.status, t.priority, t.due_date, t.completion_percentage,
        t.estimated_hours, t.actual_hours, t.created_at, t.updated_at,
        e.user_id as assigned_user_id,
        u.name as assigned_name
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE t.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = rows[0];
    res.json({
      id: task.id,
      title: task.title,
      description: task.description,
      projectId: task.project_id,
      assignedTo: task.assigned_to_id,
      assignedName: task.assigned_name,
      createdBy: task.created_by_id,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      completionPercentage: task.completion_percentage,
      estimatedHours: task.estimated_hours,
      actualHours: task.actual_hours,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    });
  } catch (err) {
    console.error('[GET_TASK]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE TASK
// ============================================================================
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const { title, description, projectId, assignedToId, status, priority, dueDate, estimatedHours } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks 
        (title, description, project_id, assigned_to_id, created_by_id, status, priority, due_date, estimated_hours, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       RETURNING id, title, description, project_id, assigned_to_id, created_by_id, status, priority, due_date, completion_percentage, created_at`,
      [title, description || null, projectId || null, assignedToId || null, req.userId, 
       status || 'pending', priority || 'medium', dueDate || null, estimatedHours || null]
    );

    const task = rows[0];

    // Create notification for assigned employee
    if (assignedToId) {
      const empRes = await pool.query('SELECT user_id FROM employees WHERE id = $1', [assignedToId]);
      if (empRes.rowCount > 0) {
        const assignedUserId = empRes.rows[0].user_id;
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [assignedUserId, 'task_assigned', 'New Task', `Task "${title}" assigned to you`, 'task', task.id]
        );
      }
    }

    res.status(201).json({
      id: task.id,
      title: task.title,
      description: task.description,
      projectId: task.project_id,
      assignedTo: task.assigned_to_id,
      createdBy: task.created_by_id,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      completionPercentage: task.completion_percentage,
      createdAt: task.created_at,
    });
  } catch (err) {
    console.error('[CREATE_TASK]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// UPDATE TASK
// ============================================================================
router.put('/:id', requireAuth, async (req, res) => {
  const { title, description, projectId, assignedToId, status, priority, dueDate, completionPercentage, actualHours } = req.body;
  const taskId = req.params.id;

  const pool = getPool();
  try {
    // Verify task exists and user has permission
    const taskRes = await pool.query('SELECT created_by_id, assigned_to_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskRes.rows[0];
    const userEmp = await pool.query('SELECT id FROM employees WHERE user_id = $1', [req.userId]);
    const userEmpId = userEmp.rowCount > 0 ? userEmp.rows[0].id : null;

    // Permission check: creator, assigned employee, or admin/manager can update
    const isCreator = task.created_by_id === req.userId;
    const isAssigned = userEmpId && task.assigned_to_id === userEmpId;
    const isAdmin = req.userRole === 'ADMIN';
    const isManager = req.userRole === 'MANAGER';

    if (!isCreator && !isAssigned && !isAdmin && !isManager) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(title);
    }
    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(description);
    }
    if (projectId !== undefined) {
      fields.push(`project_id = $${idx++}`);
      values.push(projectId);
    }
    if (assignedToId !== undefined) {
      fields.push(`assigned_to_id = $${idx++}`);
      values.push(assignedToId);
    }
    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (priority !== undefined) {
      fields.push(`priority = $${idx++}`);
      values.push(priority);
    }
    if (dueDate !== undefined) {
      fields.push(`due_date = $${idx++}`);
      values.push(dueDate);
    }
    if (completionPercentage !== undefined) {
      fields.push(`completion_percentage = $${idx++}`);
      values.push(Math.min(100, Math.max(0, completionPercentage)));
    }
    if (actualHours !== undefined) {
      fields.push(`actual_hours = $${idx++}`);
      values.push(actualHours);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = now()`);
    values.push(taskId);

    const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx + 1} 
                 RETURNING id, title, description, project_id, assigned_to_id, created_by_id, status, priority, due_date, completion_percentage, created_at, updated_at`;

    const { rows } = await pool.query(sql, values);

    res.json({
      id: rows[0].id,
      title: rows[0].title,
      description: rows[0].description,
      projectId: rows[0].project_id,
      assignedTo: rows[0].assigned_to_id,
      createdBy: rows[0].created_by_id,
      status: rows[0].status,
      priority: rows[0].priority,
      dueDate: rows[0].due_date,
      completionPercentage: rows[0].completion_percentage,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
    });
  } catch (err) {
    console.error('[UPDATE_TASK]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// DELETE TASK (Admin/Manager only)
// ============================================================================
router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const pool = getPool();
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('[DELETE_TASK]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
