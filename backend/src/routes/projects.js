const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get all projects
// Get all projects
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();

  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.created_by,
        p.deadline,
        p.priority,
        p.status,
        p.created_at,
        COALESCE(
          ARRAY_AGG(pm.user_id)
          FILTER (WHERE pm.user_id IS NOT NULL),
          '{}'
        ) AS assigned_users
      FROM projects p
      LEFT JOIN project_members pm
        ON pm.project_id = p.id
      GROUP BY
        p.id,
        p.title,
        p.description,
        p.created_by,
        p.deadline,
        p.priority,
        p.status,
        p.created_at
      ORDER BY p.created_at DESC
    `);

    res.json(
      rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        createdBy: r.created_by,
        deadline: r.deadline,
        priority: r.priority,
        status: r.status,
        createdAt: r.created_at,
        assignedUsers: r.assigned_users || [],
      }))
    );
  } catch (err) {
    console.error(err);
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
// Create Project
router.post('/', requireAuth, async (req, res) => {
  const {
    title,
    description,
    deadline,
    priority,
    status,
    assignedUsers = [],
  } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const pool = getPool();

  try {
    await pool.query('BEGIN');

    const projectResult = await pool.query(
      `
      INSERT INTO projects
      (title, description, created_by, deadline, priority, status)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        title,
        description || null,
        req.userId,
        deadline || null,
        priority || 'medium',
        status || 'active',
      ]
    );

    const project = projectResult.rows[0];

    for (const userId of assignedUsers) {
      await pool.query(
        `
        INSERT INTO project_members(project_id,user_id)
        VALUES($1,$2)
        ON CONFLICT DO NOTHING
        `,
        [project.id, userId]
      );
    }

    await pool.query('COMMIT');

    res.status(201).json({
      ...project,
      assignedUsers,
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
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

// =====================================================
// GET PROJECT MEMBERS
// =====================================================

router.get('/:id/members', requireAuth, async (req, res) => {
  const pool = getPool();

  try {

    const { rows } = await pool.query(
      `
      SELECT
      u.id AS user_id,
      u.name,
      u.email
      FROM project_members pm
      JOIN users u
      ON pm.user_id=u.id
      WHERE pm.project_id=$1
      `,
      [req.params.id]
    );

    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error:'Server error'
    });

  }

});


// =====================================================
// UPDATE PROJECT MEMBERS
// =====================================================

router.put('/:id/members', requireAuth, async (req, res) => {

  const pool=getPool();

  const {userIds=[]}=req.body;

  try{

      await pool.query('BEGIN');

      await pool.query(
        'DELETE FROM project_members WHERE project_id=$1',
        [req.params.id]
      );

      for(const uid of userIds){

          await pool.query(
            `
            INSERT INTO project_members(project_id,user_id)
            VALUES($1,$2)
            `,
            [req.params.id,uid]
          );

      }

      await pool.query('COMMIT');

      res.json({
        success:true
      });

  }catch(err){

      await pool.query('ROLLBACK');

      console.error(err);

      res.status(500).json({
        error:'Server error'
      });

  }

});

module.exports = router;
