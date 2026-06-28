const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

router.get('/user/:userId', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, user_id, title, message, read, type, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC', [req.params.userId]);
  res.json(rows.map(r => ({ id: r.id, userId: r.user_id, title: r.title, message: r.message, read: r.read, type: r.type, createdAt: r.created_at })));
});

module.exports = router;
