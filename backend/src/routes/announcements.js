const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

router.get('/', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, title, message, created_by, created_at FROM announcements ORDER BY created_at DESC');
  res.json(rows.map(r => ({ id: r.id, title: r.title, message: r.message, createdBy: r.created_by, createdAt: r.created_at })));
});

router.post('/', async (req, res) => {
  const pool = getPool();
  const { title, message, createdBy } = req.body;
  const { rows } = await pool.query('INSERT INTO announcements (title, message, created_by) VALUES ($1,$2,$3) RETURNING id, title, message, created_by, created_at', [title, message, createdBy]);
  res.status(201).json(rows[0]);
});

module.exports = router;
