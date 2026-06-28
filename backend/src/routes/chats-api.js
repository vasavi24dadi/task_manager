const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// ============================================================================
// GET CONVERSATIONS (current user)
// ============================================================================
router.get('/conversations', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT 
        c.id, c.type, c.name, c.created_by_id, c.created_at, c.updated_at,
        COUNT(DISTINCT m.id) as message_count,
        MAX(m.created_at) as last_message_at,
        m.content as last_message_content
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE cp.user_id = $1
      GROUP BY c.id, m.id
      ORDER BY c.updated_at DESC`,
      [req.userId]
    );

    const conversations = rows.map(c => ({
      id: c.id,
      type: c.type,
      name: c.name,
      createdBy: c.created_by_id,
      messageCount: parseInt(c.message_count),
      lastMessageAt: c.last_message_at,
      lastMessageContent: c.last_message_content,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    res.json(conversations);
  } catch (err) {
    console.error('[GET_CONVERSATIONS]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// GET MESSAGES IN CONVERSATION
// ============================================================================
router.get('/conversations/:conversationId/messages', requireAuth, async (req, res) => {
  const pool = getPool();
  const { conversationId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Verify user is participant
    const participantRes = await pool.query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.userId]
    );

    if (participantRes.rowCount === 0) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await pool.query(
      `SELECT 
        m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.file_url, m.file_type,
        m.is_edited, m.edited_at, m.is_deleted, m.reactions, m.created_at,
        u.name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1 AND m.is_deleted = false
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3`,
      [conversationId, parseInt(limit), parseInt(offset)]
    );

    const messages = rows.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderAvatar: m.sender_avatar,
      content: m.content,
      messageType: m.message_type,
      fileUrl: m.file_url,
      fileType: m.file_type,
      isEdited: m.is_edited,
      editedAt: m.edited_at,
      reactions: m.reactions || {},
      createdAt: m.created_at,
    }));

    res.json(messages.reverse()); // Return in chronological order
  } catch (err) {
    console.error('[GET_MESSAGES]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// SEND MESSAGE
// ============================================================================
router.post('/conversations/:conversationId/messages', requireAuth, async (req, res) => {
  const pool = getPool();
  const { conversationId } = req.params;
  const { content, messageType = 'text', fileUrl = null, fileType = null } = req.body;

  if (!content && !fileUrl) {
    return res.status(400).json({ error: 'Content or file is required' });
  }

  try {
    // Verify user is participant
    const participantRes = await pool.query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.userId]
    );

    if (participantRes.rowCount === 0) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, file_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id, conversation_id, sender_id, content, message_type, file_url, file_type, created_at`,
      [conversationId, req.userId, content, messageType, fileUrl, fileType]
    );

    const message = rows[0];

    // Update conversation updated_at
    await pool.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [conversationId]);

    res.status(201).json({
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      content: message.content,
      messageType: message.message_type,
      fileUrl: message.file_url,
      fileType: message.file_type,
      createdAt: message.created_at,
    });
  } catch (err) {
    console.error('[SEND_MESSAGE]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE DIRECT CONVERSATION
// ============================================================================
router.post('/conversations/direct/:otherUserId', requireAuth, async (req, res) => {
  const pool = getPool();
  const { otherUserId } = req.params;

  try {
    // Check if conversation already exists
    const existing = await pool.query(
      `SELECT c.id FROM conversations c
       INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
       INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
       WHERE c.type = 'direct'
       LIMIT 1`,
      [req.userId, otherUserId]
    );

    if (existing.rowCount > 0) {
      return res.json({ id: existing.rows[0].id });
    }

    // Create new conversation
    const { rows: convRows } = await pool.query(
      'INSERT INTO conversations (type, created_by_id, created_at, updated_at) VALUES ($1, $2, now(), now()) RETURNING id',
      ['direct', req.userId]
    );

    const conversationId = convRows[0].id;

    // Add participants
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
       VALUES ($1, $2, now()), ($1, $3, now())`,
      [conversationId, req.userId, otherUserId]
    );

    res.status(201).json({ id: conversationId });
  } catch (err) {
    console.error('[CREATE_CONVERSATION]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// CREATE GROUP CONVERSATION
// ============================================================================
router.post('/conversations/group', requireAuth, async (req, res) => {
  const pool = getPool();
  const { name, participantIds } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Create conversation
    const { rows: convRows } = await pool.query(
      'INSERT INTO conversations (type, name, created_by_id, created_at, updated_at) VALUES ($1, $2, $3, now(), now()) RETURNING id',
      ['group', name, req.userId]
    );

    const conversationId = convRows[0].id;

    // Add creator as participant
    const allParticipants = [req.userId, ...(participantIds || [])];
    const uniqueParticipants = [...new Set(allParticipants)];

    for (const userId of uniqueParticipants) {
      await pool.query(
        'INSERT INTO conversation_participants (conversation_id, user_id, joined_at) VALUES ($1, $2, now())',
        [conversationId, userId]
      );
    }

    res.status(201).json({ id: conversationId, name, participantCount: uniqueParticipants.length });
  } catch (err) {
    console.error('[CREATE_GROUP]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// MARK MESSAGE AS READ
// ============================================================================
router.post('/messages/:messageId/read', requireAuth, async (req, res) => {
  const pool = getPool();
  const { messageId } = req.params;

  try {
    // Check if already marked as read
    const existing = await pool.query(
      'SELECT id FROM message_reads WHERE message_id = $1 AND user_id = $2',
      [messageId, req.userId]
    );

    if (existing.rowCount === 0) {
      await pool.query(
        'INSERT INTO message_reads (message_id, user_id, read_at) VALUES ($1, $2, now())',
        [messageId, req.userId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[MARK_READ]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// EDIT MESSAGE
// ============================================================================
router.put('/messages/:messageId', requireAuth, async (req, res) => {
  const pool = getPool();
  const { messageId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    // Verify ownership
    const msgRes = await pool.query('SELECT sender_id FROM messages WHERE id = $1', [messageId]);
    if (msgRes.rowCount === 0 || msgRes.rows[0].sender_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await pool.query(
      'UPDATE messages SET content = $1, is_edited = true, edited_at = now() WHERE id = $2 RETURNING *',
      [content, messageId]
    );

    res.json({
      id: rows[0].id,
      content: rows[0].content,
      isEdited: rows[0].is_edited,
      editedAt: rows[0].edited_at,
    });
  } catch (err) {
    console.error('[EDIT_MESSAGE]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// DELETE MESSAGE
// ============================================================================
router.delete('/messages/:messageId', requireAuth, async (req, res) => {
  const pool = getPool();
  const { messageId } = req.params;

  try {
    // Verify ownership
    const msgRes = await pool.query('SELECT sender_id FROM messages WHERE id = $1', [messageId]);
    if (msgRes.rowCount === 0 || msgRes.rows[0].sender_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query('UPDATE messages SET is_deleted = true WHERE id = $1', [messageId]);

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('[DELETE_MESSAGE]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
