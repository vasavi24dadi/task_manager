const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get all projects
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT id, title, description, created_by, deadline, priority, status, created_at FROM projects ORDER BY created_at DESC');
    res.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      createdBy: r.created_by,
      deadline: r.deadline,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get project by ID
router.get('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT id, title, description, created_by, deadline, priority, status, created_at FROM projects WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    const r = rows[0];
    res.json({
      id: r.id,
      title: r.title,
      description: r.description,
      createdBy: r.created_by,
      deadline: r.deadline,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at
    });
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a project
router.post('/', requireAuth, async (req, res) => {
  const { title, description, deadline, priority, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'INSERT INTO projects (title, description, created_by, deadline, priority, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description || null, req.userId, deadline || null, priority || 'medium', status || 'active']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a project
router.put('/:id', requireAuth, async (req, res) => {
  const { title, description, deadline, priority, status } = req.body;
  const pool = getPool();
  try {
    const fields = [];
    const vals = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title=$${idx++}`); vals.push(title); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); vals.push(description); }
    if (deadline !== undefined) { fields.push(`deadline=$${idx++}`); vals.push(deadline); }
    if (priority !== undefined) { fields.push(`priority=$${idx++}`); vals.push(priority); }
    if (status !== undefined) { fields.push(`status=$${idx++}`); vals.push(status); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    const sql = `UPDATE projects SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`;
    const { rows } = await pool.query(sql, vals);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete project
router.delete('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
