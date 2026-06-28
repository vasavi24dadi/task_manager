const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get conversations for current user
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT c.*, 
        (SELECT json_agg(u.id) FROM chat_participants cp2 JOIN users u ON u.id = cp2.user_id WHERE cp2.chat_id = c.id) as participants,
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', u.role, 'avatarUrl', u.avatar_url)) FROM chat_participants cp3 JOIN users u ON u.id = cp3.user_id WHERE cp3.chat_id = c.id) as participant_profiles
       FROM chats c
       JOIN chat_participants cp ON cp.chat_id = c.id
       WHERE cp.user_id = $1
       ORDER BY c.updated_at DESC`,
      [req.userId]
    );
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      projectId: r.project_id,
      participants: r.participants || [],
      participantProfiles: r.participant_profiles || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })));
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new direct or project conversation
router.post('/', requireAuth, async (req, res) => {
  const { otherUserId, projectId, type, name } = req.body;
  const pool = getPool();
  try {
    if (type === 'direct') {
      if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required for direct chats' });
      
      // Check if direct conversation already exists
      const existing = await pool.query(
        `SELECT cp1.chat_id 
         FROM chat_participants cp1
         JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
         JOIN chats c ON c.id = cp1.chat_id
         WHERE c.type = 'direct' AND cp1.user_id = $1 AND cp2.user_id = $2`,
        [req.userId, otherUserId]
      );
      if (existing.rows.length) {
        // Return existing conversation detail
        const { rows } = await pool.query(
          `SELECT c.*, 
            (SELECT json_agg(u.id) FROM chat_participants cp2 JOIN users u ON u.id = cp2.user_id WHERE cp2.chat_id = c.id) as participants
           FROM chats c WHERE c.id = $1`,
          [existing.rows[0].chat_id]
        );
        return res.json(rows[0]);
      }

      // Create new chat
      const chatRes = await pool.query(
        "INSERT INTO chats (name, type) VALUES ($1, 'direct') RETURNING *",
        [name || 'Direct Chat']
      );
      const newChat = chatRes.rows[0];

      // Add participants
      await pool.query('INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)', [newChat.id, req.userId, otherUserId]);
      newChat.participants = [req.userId, otherUserId];
      return res.status(201).json(newChat);
    } else {
      // Project / Group Chat
      const chatRes = await pool.query(
        "INSERT INTO chats (name, type, project_id) VALUES ($1, $2, $3) RETURNING *",
        [name || 'Group Chat', type || 'group', projectId || null]
      );
      const newChat = chatRes.rows[0];

      // Add initiator
      await pool.query('INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2)', [newChat.id, req.userId]);
      
      // Add project members if project_id is provided
      if (projectId) {
        // For simplicity, add all users to project group chat
        const users = await pool.query('SELECT id FROM users');
        for (const u of users.rows) {
          if (u.id !== req.userId) {
            await pool.query('INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newChat.id, u.id]);
          }
        }
      }
      
      const parts = await pool.query('SELECT user_id FROM chat_participants WHERE chat_id = $1', [newChat.id]);
      newChat.participants = parts.rows.map(p => p.user_id);
      return res.status(201).json(newChat);
    }
  } catch (err) {
    console.error('Error creating conversation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a specific conversation
router.get('/:id/messages', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    // Check if participant
    const partCheck = await pool.query('SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!partCheck.rows.length) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(
      'SELECT id, chat_id, sender_id, content, type, file_url, status, seen_at, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(rows.map(r => ({
      id: r.id,
      conversationId: r.chat_id,
      senderId: r.sender_id,
      content: r.content,
      type: r.type,
      fileUrl: r.file_url,
      status: r.status,
      seenAt: r.seen_at,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Post a new message
router.post('/:id/messages', requireAuth, async (req, res) => {
  const { content, type, fileUrl } = req.body;
  const pool = getPool();
  try {
    // Check if participant
    const partCheck = await pool.query('SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!partCheck.rows.length) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(
      'INSERT INTO messages (chat_id, sender_id, content, type, file_url, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.id, req.userId, content || '', type || 'text', fileUrl || null, 'sent']
    );
    
    // Update chat updated_at timestamp
    await pool.query('UPDATE chats SET updated_at = now() WHERE id = $1', [req.params.id]);

    const msg = rows[0];
    res.status(201).json({
      id: msg.id,
      conversationId: msg.chat_id,
      senderId: msg.sender_id,
      content: msg.content,
      type: msg.type,
      fileUrl: msg.file_url,
      status: msg.status,
      createdAt: msg.created_at
    });
  } catch (err) {
    console.error('Error posting message:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
