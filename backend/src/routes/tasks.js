const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get all tasks
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT id, title, description, project_id, assigned_to, created_by, status, priority, due_date, created_at FROM tasks ORDER BY created_at DESC');
    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      projectId: r.project_id,
      assignedTo: r.assigned_to,
      createdBy: r.created_by,
      status: r.status,
      priority: r.priority,
      dueDate: r.due_date,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get task by ID
router.get('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT id, title, description, project_id, assigned_to, created_by, status, priority, due_date, created_at FROM tasks WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    const r = rows[0];
    res.json({
      id: r.id,
      title: r.title,
      description: r.description,
      projectId: r.project_id,
      assignedTo: r.assigned_to,
      createdBy: r.created_by,
      status: r.status,
      priority: r.priority,
      dueDate: r.due_date,
      createdAt: r.created_at
    });
  } catch (err) {
    console.error('Error fetching task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a task
router.post('/', requireAuth, async (req, res) => {
  const { title, description, projectId, assignedTo, status, priority, dueDate } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description || null, projectId || null, assignedTo || null, req.userId, status || 'pending', priority || 'medium', dueDate || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a task
router.put('/:id', requireAuth, async (req, res) => {
  const { title, description, projectId, assignedTo, status, priority, dueDate } = req.body;
  const pool = getPool();
  try {
    const fields = [];
    const vals = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title=$${idx++}`); vals.push(title); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); vals.push(description); }
    if (projectId !== undefined) { fields.push(`project_id=$${idx++}`); vals.push(projectId); }
    if (assignedTo !== undefined) { fields.push(`assigned_to=$${idx++}`); vals.push(assignedTo); }
    if (status !== undefined) { fields.push(`status=$${idx++}`); vals.push(status); }
    if (priority !== undefined) { fields.push(`priority=$${idx++}`); vals.push(priority); }
    if (dueDate !== undefined) { fields.push(`due_date=$${idx++}`); vals.push(dueDate); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    const sql = `UPDATE tasks SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`;
    const { rows } = await pool.query(sql, vals);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task
router.delete('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
