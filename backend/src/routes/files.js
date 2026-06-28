const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get list of uploaded files
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT f.*, u.name as uploader_name 
       FROM files f 
       LEFT JOIN users u ON u.id = f.uploaded_by 
       ORDER BY f.created_at DESC`
    );
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      url: r.url,
      size: r.size,
      mimeType: r.mime_type,
      uploadedBy: r.uploaded_by,
      uploaderName: r.uploader_name,
      projectId: r.project_id,
      taskId: r.task_id,
      chatId: r.chat_id,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Error fetching files:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload/Register a file record
router.post('/', requireAuth, async (req, res) => {
  const { name, url, size, mimeType, projectId, taskId, chatId } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'File name and URL are required' });
  }
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `INSERT INTO files (name, url, size, mime_type, uploaded_by, project_id, task_id, chat_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, url, size || null, mimeType || null, req.userId, projectId || null, taskId || null, chatId || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error uploading file record:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
