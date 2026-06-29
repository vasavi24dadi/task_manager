const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Schema used:
// tasks: id, title, description, project_id, assigned_to, created_by, priority, status, due_date, created_at
// profiles: id, name, email, role

// Utility to map DB row to frontend-friendly task object
function mapTaskRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name || null,
    createdBy: row.created_by,
    createdByName: row.created_name || null,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
  };
}

// ============================================================================
// GET ALL TASKS
// ============================================================================
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const params = [];
    let where = '';

    // Role-based filtering
    if (req.userRole === 'INTERN') {
      where = 'WHERE t.assigned_to = $1';
      params.push(req.userId);
    } else if (req.userRole === 'MANAGER') {
      // Managers see tasks they created or tasks assigned to them
      where = 'WHERE t.created_by = $1 OR t.assigned_to = $1';
      params.push(req.userId);
    }

    const sql = `
      SELECT
        t.id, t.title, t.description, t.project_id, t.assigned_to, t.created_by,
        t.status, t.priority, t.due_date, t.created_at,
        pa.name as assigned_name, pc.name as created_name
      FROM tasks t
      LEFT JOIN profiles pa ON t.assigned_to = pa.id
      LEFT JOIN profiles pc ON t.created_by = pc.id
      ${where}
      ORDER BY t.due_date ASC NULLS LAST, t.priority DESC
    `;

    const { rows } = await pool.query(sql, params);
    return res.json(rows.map(mapTaskRow));
  } catch (err) {
    console.error('[GET_TASKS]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET TASK BY ID
// ============================================================================
router.get('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.description, t.project_id, t.assigned_to, t.created_by,
              t.status, t.priority, t.due_date, t.created_at,
              pa.name as assigned_name, pc.name as created_name
       FROM tasks t
       LEFT JOIN profiles pa ON t.assigned_to = pa.id
       LEFT JOIN profiles pc ON t.created_by = pc.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = rows[0];
    return res.json(mapTaskRow(task));
  } catch (err) {
    console.error('[GET_TASK]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE TASK
// ============================================================================
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER', 'HR'), async (req, res) => {
  const { title, description, projectId, assignedTo, status, priority, dueDate } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority, due_date, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
       RETURNING id, title, description, project_id, assigned_to, created_by, status, priority, due_date, created_at`,
      [title, description || null, projectId || null, assignedTo || null, req.userId, status || 'pending', priority || 'medium', dueDate || null]
    );

    const created = rows[0];

    if (assignedTo && assignedTo !== req.userId) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [assignedTo, 'task_assigned', 'Task assigned', `You were assigned to task "${title}"`, 'task', created.id]
      );
    }

    // Fetch names for created object
    const nameRes = await pool.query(
      `SELECT pa.name as assigned_name, pc.name as created_name
       FROM tasks t
       LEFT JOIN profiles pa ON t.assigned_to = pa.id
       LEFT JOIN profiles pc ON t.created_by = pc.id
       WHERE t.id = $1`,
      [created.id]
    );

    const rowWithNames = { ...created, ...nameRes.rows[0] };
    return res.status(201).json(mapTaskRow(rowWithNames));
  } catch (err) {
    console.error('[CREATE_TASK]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// UPDATE TASK
// ============================================================================
router.put('/:id', requireAuth, async (req, res) => {
  const { title, description, projectId, assignedTo, status, priority, dueDate } = req.body;
  const taskId = req.params.id;
  const pool = getPool();
  try {
    const taskRes = await pool.query('SELECT id, created_by, assigned_to FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

    const task = taskRes.rows[0];

    const isCreator = task.created_by === req.userId;
    const isAssigned = task.assigned_to === req.userId;
    const isAdmin = req.userRole === 'ADMIN';
    const isManager = req.userRole === 'MANAGER';

    if (!isCreator && !isAssigned && !isAdmin && !isManager) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (projectId !== undefined) { fields.push(`project_id = $${idx++}`); values.push(projectId); }
    if (assignedTo !== undefined) { fields.push(`assigned_to = $${idx++}`); values.push(assignedTo); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
    if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
    if (dueDate !== undefined) { fields.push(`due_date = $${idx++}`); values.push(dueDate); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, title, description, project_id, assigned_to, created_by, status, priority, due_date, created_at`;
    values.push(taskId);

    const { rows } = await pool.query(sql, values);

    if (assignedTo !== undefined && assignedTo !== task.assigned_to && assignedTo !== req.userId) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [assignedTo, 'task_assigned', 'Task assigned', `You were assigned to task "${title || rows[0].title}"`, 'task', rows[0].id]
      );
    }

    // Attach names
    const nameRes = await pool.query(
      `SELECT pa.name as assigned_name, pc.name as created_name
       FROM tasks t
       LEFT JOIN profiles pa ON t.assigned_to = pa.id
       LEFT JOIN profiles pc ON t.created_by = pc.id
       WHERE t.id = $1`,
      [rows[0].id]
    );

    const rowWithNames = { ...rows[0], ...nameRes.rows[0] };
    return res.json(mapTaskRow(rowWithNames));
  } catch (err) {
    console.error('[UPDATE_TASK]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// DELETE TASK
// ============================================================================
router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const pool = getPool();
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    return res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('[DELETE_TASK]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
