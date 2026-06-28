const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

router.get('/', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, name, description, created_by, created_at FROM teams ORDER BY created_at DESC');
  res.json(rows.map(r => ({ id: r.id, name: r.name, description: r.description, createdBy: r.created_by, createdAt: r.created_at })));
});

module.exports = router;
