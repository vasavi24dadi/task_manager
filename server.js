/**
 * TaskFlow Real-time Communication Server
 * Handles WebSocket connections for messaging and calling
 * Hybrid approach: Socket.io for real-time messaging and database persistence
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ════════════════════════════════════════════════════════════════════
// CORS & Middleware Setup
// ════════════════════════════════════════════════════════════════════
app.use(cors());
app.use(express.json());

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN
      ? process.env.SOCKET_CORS_ORIGIN.split(',').map((item) => item.trim())
      : true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// ════════════════════════════════════════════════════════════════════
// Lightweight persistence adapter for the REST migration
// ════════════════════════════════════════════════════════════════════
const createNoopQuery = () => ({
  select() { return this; },
  eq() { return this; },
  in() { return this; },
  order() { return this; },
  limit() { return this; },
  update() { return Promise.resolve({ data: null, error: null }); },
  delete() { return Promise.resolve({ data: null, error: null }); },
  insert() { return Promise.resolve({ data: null, error: null }); },
  upsert() { return Promise.resolve({ data: null, error: null }); },
  single() { return Promise.resolve({ data: null, error: null }); },
  maybeSingle() { return Promise.resolve({ data: null, error: null }); },
  then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
});

const db = {
  from() {
    return createNoopQuery();
  },
};

// ════════════════════════════════════════════════════════════════════
// In-Memory Storage (for active connections & call sessions)
// ════════════════════════════════════════════════════════════════════
const userSockets = new Map(); // userId -> { socketId, conversationIds }
const activeCallSessions = new Map(); // callId -> { participants, type, status }
const typingIndicators = new Map(); // conversationId -> Set of typing userIds
const messageDeliveryQueue = new Map(); // userId -> Array of undelivered messages

// ════════════════════════════════════════════════════════════════════
// Socket.io Event Handlers
// ════════════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log(`✓ User connected: ${socket.id}`);

  // ─────────────────────────────────────────────────────────────────
  // USER AUTHENTICATION & PRESENCE
  // ─────────────────────────────────────────────────────────────────

  socket.on('user:authenticate', (userId, conversationIds = []) => {
    console.log(`🔐 Authenticating user: ${userId}`);

    // Store user socket mapping
    userSockets.set(userId, {
      socketId: socket.id,
      conversationIds: new Set(conversationIds),
      authenticated: true,
      lastSeen: new Date(),
    });

    // Join socket to user room for targeted messaging
    socket.join(`user:${userId}`);

    // Join user to all conversation rooms
    conversationIds.forEach((convId) => {
      socket.join(`conversation:${convId}`);
    });

    // Notify conversation peers that this user is online
    conversationIds.forEach((convId) => {
      socket.to(`conversation:${convId}`).emit('user:online', {
        userId,
        timestamp: new Date().toISOString(),
      });
    });

    console.log(`✓ User ${userId} joined ${conversationIds.length} conversations`);

    // Deliver any queued messages
    if (messageDeliveryQueue.has(userId)) {
      const queuedMessages = messageDeliveryQueue.get(userId);
      queuedMessages.forEach((msg) => {
        socket.emit('message:delivered', msg);
      });
      messageDeliveryQueue.delete(userId);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // MESSAGING SYSTEM
  // ─────────────────────────────────────────────────────────────────

  socket.on('message:send', async (payload) => {
    if (!payload?.conversationId || !payload?.senderId) {
      return socket.emit('error', { message: 'Invalid message payload' });
    }
    

    try {
      const {
        conversationId,
        messageId = crypto.randomUUID(),
        senderId,
        content,
        timestamp = new Date().toISOString(),
      } = payload;

      const senderSocketData = userSockets.get(senderId);
      if (!senderSocketData || !senderSocketData.conversationIds.has(conversationId)) {
        return socket.emit('error', { message: 'Unauthorized access to conversation' });
      }

      await db.from('messages').upsert({
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        delivery_status: 'delivered',
      });

      io.to(`user:${senderId}`).emit('message:sent', {
        messageId,
        conversationId,
        status: 'sent',
        timestamp,
      });

      io.to(`conversation:${conversationId}`).emit('message:new', {
        messageId,
        conversationId,
        senderId,
        content,
        timestamp,
        status: 'delivered',
      });

      userSockets.forEach((userData, userId) => {
        if (userId !== senderId && userData.conversationIds.has(conversationId)) {
          io.to(`user:${userId}`).emit('message:new', {
            messageId,
            conversationId,
            senderId,
            content,
            timestamp,
            status: 'delivered',
          });
        }
      });

      userSockets.forEach((userData, userId) => {
        if (userId !== senderId && !io.sockets.adapter.rooms.get(`user:${userId}`) && userData.conversationIds.has(conversationId)) {
          if (!messageDeliveryQueue.has(userId)) {
            messageDeliveryQueue.set(userId, []);
          }
          messageDeliveryQueue.get(userId).push({
            messageId,
            conversationId,
            senderId,
            content,
            timestamp,
          });
        }
      });
    } catch (error) {
      console.error('❌ Error handling message:send:', error);
      socket.emit('error', { type: 'message:send_failed', message: error.message });
    }
  });

socket.on("message:delivered", async ({ messageId }) => {
  await db
    .from("messages")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString()
    })
    .eq("id", messageId);

  io.emit("message:status", {
    messageId,
    status: "delivered"
  });
});

  socket.on('message:seen', async (payload) => {
    try {
      const { conversationId, messageIds, userId } = payload;

      // Update seen status in the database
      const { error } = await db
        .from('messages')
        .update({ status: 'seen', seen_at: new Date().toISOString() })
        .in('id', messageIds)
        .eq('conversation_id', conversationId);

      if (error) console.error('❌ Error marking messages as seen:', error);

      // Notify all users in conversation about seen status
      io.to(`conversation:${conversationId}`).emit('message:seen', {
        conversationId,
        messageIds,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Error handling message:seen:', error);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // TYPING INDICATORS
  // ─────────────────────────────────────────────────────────────────

  socket.on('typing:start', (conversationId, userId) => {
    if (!typingIndicators.has(conversationId)) {
      typingIndicators.set(conversationId, new Set());
    }
    typingIndicators.get(conversationId).add(userId);

    io.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      typingUsers: Array.from(typingIndicators.get(conversationId)),
    });
  });

  socket.on('typing:stop', (conversationId, userId) => {
    if (typingIndicators.has(conversationId)) {
      typingIndicators.get(conversationId).delete(userId);

      io.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        typingUsers: Array.from(typingIndicators.get(conversationId)),
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // CALLING SYSTEM (WebRTC Signaling)
  // ─────────────────────────────────────────────────────────────────

  socket.on('call:initiate', (payload) => {
    try {
      const { callId, initiatorId, recipientId, type, conversationId } = payload;

      console.log(`📞 Call initiated: ${initiatorId} -> ${recipientId} (${type})`);

      // Store call session
      activeCallSessions.set(callId, {
        callId,
        initiatorId,
        type, // 'audio' or 'video'
        recipientId, // for 1-to-1 calls
        conversationId, // for group calls - can have multiple participants
        participants: [{ userId: initiatorId, status: 'initiating' }],
        status: 'ringing',
        startedAt: new Date().toISOString(),
        createdAt: new Date(),
      });

      // Notify recipient
      io.to(`user:${recipientId}`).emit('call:ringing', {
        callId,
        initiatorId,
        type,
        conversationId,
      });

      console.log(`✓ Ringing notification sent to ${recipientId}`);
    } catch (error) {
      console.error('❌ Error handling call:initiate:', error);
      socket.emit('error', { type: 'call:initiate_failed', message: error.message });
    }
  });

  socket.on('call:accept', (payload) => {
    try {
      const { callId, userId } = payload;
      const callSession = activeCallSessions.get(callId);

      if (!callSession) {
        console.error(`❌ Call session not found: ${callId}`);
        return;
      }

      console.log(`✓ Call accepted by ${userId}`);

      // Update call session status
      callSession.status = 'ongoing';
      callSession.participants.push({ userId, status: 'joined', joinedAt: new Date() });
      callSession.answeredAt = new Date().toISOString();

      // Notify initiator
      io.to(`user:${callSession.initiatorId}`).emit('call:accepted', {
        callId,
        acceptedBy: userId,
      });

      // All participants join call room
      // Notify ALL participants (fixed)
callSession.participants.forEach((p) => {
  io.to(`user:${p.userId}`).emit('call:start', {
    callId,
    type: callSession.type,
  });
});

// Ensure initiator also gets it
io.to(`user:${callSession.initiatorId}`).emit('call:start', {
  callId,
  type: callSession.type,
});
    } catch (error) {
      console.error('❌ Error handling call:accept:', error);
    }
  });

  socket.on('call:reject', (payload) => {
    try {
      const { callId, userId, reason } = payload;
      const callSession = activeCallSessions.get(callId);

      if (!callSession) return;

      console.log(`✗ Call rejected by ${userId}: ${reason}`);

      io.to(`user:${callSession.initiatorId}`).emit('call:rejected', {
        callId,
        rejectedBy: userId,
        reason,
      });

      activeCallSessions.delete(callId);
    } catch (error) {
      console.error('❌ Error handling call:reject:', error);
    }
  });

  socket.on('call:end', (payload) => {
    try {
      const { callId, userId } = payload;
      const callSession = activeCallSessions.get(callId);

      if (!callSession) return;

      console.log(`✓ Call ended by ${userId}`);

      callSession.status = 'ended';
      callSession.endedAt = new Date().toISOString();

     // Notify ALL participants
callSession.participants.forEach((p) => {
  io.to(`user:${p.userId}`).emit('call:ended', {
    callId,
    endedBy: userId,
    duration:
      new Date(callSession.endedAt) -
      new Date(callSession.startedAt),
  });
});

// Safety: notify initiator too
io.to(`user:${callSession.initiatorId}`).emit('call:ended', {
  callId,
  endedBy: userId,
});

      activeCallSessions.delete(callId);
    } catch (error) {
      console.error('❌ Error handling call:end:', error);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // WebRTC SIGNALING (ICE candidates & SDP offers/answers)
  // ─────────────────────────────────────────────────────────────────

  socket.on('webrtc:offer', (payload) => {
    const { callId, from, to, offer } = payload;
    console.log(`🔗 WebRTC offer from ${from} to ${to}`);

    if (to) {
      io.to(`user:${to}`).emit('webrtc:offer', {
        callId,
        from,
        offer,
      });
      return;
    }

    const session = activeCallSessions.get(callId);
    if (session) {
      session.participants
        .filter((participant) => participant.userId !== from)
        .forEach((participant) => {
          io.to(`user:${participant.userId}`).emit('webrtc:offer', {
            callId,
            from,
            offer,
          });
        });
    }
  });

  socket.on('webrtc:answer', (payload) => {
    const { callId, from, to, answer } = payload;
    console.log(`🔗 WebRTC answer from ${from} to ${to}`);

    if (to) {
      io.to(`user:${to}`).emit('webrtc:answer', {
        callId,
        from,
        answer,
      });
      return;
    }

    const session = activeCallSessions.get(callId);
    if (session) {
      session.participants
        .filter((participant) => participant.userId !== from)
        .forEach((participant) => {
          io.to(`user:${participant.userId}`).emit('webrtc:answer', {
            callId,
            from,
            answer,
          });
        });
    }
  });

  socket.on('webrtc:ice-candidate', (payload) => {
    const { callId, from, to, candidate } = payload;
    console.log(`❄️ ICE candidate from ${from}`);

    if (to) {
      io.to(`user:${to}`).emit('webrtc:ice-candidate', {
        callId,
        from,
        candidate,
      });
      return;
    }

    const session = activeCallSessions.get(callId);
    if (session) {
      session.participants
        .filter((participant) => participant.userId !== from)
        .forEach((participant) => {
          io.to(`user:${participant.userId}`).emit('webrtc:ice-candidate', {
            callId,
            from,
            candidate,
          });
        });
    }
  });

  socket.on('webrtc:connection-state', (payload) => {
    const { callId, from, state } = payload;
    console.log(`🔌 Connection state: ${from} -> ${state}`);

    io.emit('webrtc:connection-state', { callId, from, state });
  });

  // ─────────────────────────────────────────────────────────────────
  // KANBAN BOARD - REAL-TIME TASK EVENTS
  // ─────────────────────────────────────────────────────────────────

  socket.on('task:join-board', (projectId, userId) => {
    console.log(`📌 User ${userId} joined task board for project ${projectId}`);
    socket.join(`project:${projectId}:tasks`);
    
    // Notify others that user is viewing the board
    socket.to(`project:${projectId}:tasks`).emit('task:user-viewing', {
      userId,
      projectId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('task:leave-board', (projectId, userId) => {
    console.log(`📌 User ${userId} left task board for project ${projectId}`);
    socket.leave(`project:${projectId}:tasks`);
    
    socket.to(`project:${projectId}:tasks`).emit('task:user-left', {
      userId,
      projectId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('task:created', async (payload) => {
    try {
      const { taskId, projectId, userId, task } = payload;
      
      console.log(`✨ Task created: ${taskId} in project ${projectId}`);

      // Log activity
      await db.from('activity_logs').insert({
        user_id: userId,
        task_id: taskId,
        action: 'created',
        entity_type: 'task',
        entity_id: taskId,
        new_value: {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast to all users viewing this project's board
      io.to(`project:${projectId}:tasks`).emit('task:created', {
        taskId,
        projectId,
        userId,
        task,
        timestamp: new Date().toISOString(),
      });

      // Create notification for assignee
      if (task.assigned_to) {
        await db.from('notifications').insert({
          user_id: task.assigned_to,
          title: 'Task Assigned',
          message: `${task.created_by_name || 'Someone'} created and assigned: "${task.title}"`,
          type: 'task_assigned',
          task_id: taskId,
          action_type: 'assigned',
          read: false,
        });

        io.to(`user:${task.assigned_to}`).emit('notification:new', {
          type: 'task_assigned',
          taskId,
          message: `Task assigned: ${task.title}`,
        });
      }
    } catch (error) {
      console.error('❌ Error handling task:created:', error);
    }
  });

  socket.on('task:moved', async (payload) => {
    try {
      const { taskId, projectId, userId, fromStatus, toStatus } = payload;
      
      console.log(`🔄 Task ${taskId} moved from ${fromStatus} to ${toStatus}`);

      // Log activity
      await db.from('activity_logs').insert({
        user_id: userId,
        task_id: taskId,
        action: 'moved',
        entity_type: 'task',
        entity_id: taskId,
        old_value: { status: fromStatus },
        new_value: { status: toStatus },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast status change to all viewers
      io.to(`project:${projectId}:tasks`).emit('task:updated', {
        taskId,
        projectId,
        userId,
        status: toStatus,
        changes: {
          status: { from: fromStatus, to: toStatus },
        },
        timestamp: new Date().toISOString(),
      });

      // Notify watchers
      const { data: assignments } = await db
        .from('task_assignments')
        .select('assigned_to')
        .eq('task_id', taskId);

      if (assignments && assignments.length > 0) {
        assignments.forEach(async (assignment) => {
          if (assignment.assigned_to !== userId) {
            await db.from('notifications').insert({
              user_id: assignment.assigned_to,
              title: 'Task Status Updated',
              message: `Task moved to ${toStatus}`,
              type: 'task_status_changed',
              task_id: taskId,
              action_type: 'status_changed',
              read: false,
            });

            io.to(`user:${assignment.assigned_to}`).emit('notification:new', {
              type: 'task_status_changed',
              taskId,
              status: toStatus,
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ Error handling task:moved:', error);
    }
  });

  socket.on('task:updated', async (payload) => {
    try {
      const { taskId, projectId, userId, oldValues, newValues } = payload;
      
      console.log(`✏️ Task ${taskId} updated in project ${projectId}`);

      // Log activity
      await db.from('activity_logs').insert({
        user_id: userId,
        task_id: taskId,
        action: 'updated',
        entity_type: 'task',
        entity_id: taskId,
        old_value: oldValues,
        new_value: newValues,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast changes
      io.to(`project:${projectId}:tasks`).emit('task:updated', {
        taskId,
        projectId,
        userId,
        changes: {
          old: oldValues,
          new: newValues,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Error handling task:updated:', error);
    }
  });

  socket.on('task:comment', async (payload) => {
    try {
      const { taskId, projectId, userId, commentId, content } = payload;
      
      console.log(`💬 Comment added to task ${taskId}`);

      // Log activity
      await db.from('activity_logs').insert({
        user_id: userId,
        task_id: taskId,
        action: 'commented',
        entity_type: 'comment',
        entity_id: commentId,
        new_value: { content },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast comment
      io.to(`project:${projectId}:tasks`).emit('task:comment-added', {
        taskId,
        projectId,
        userId,
        commentId,
        content,
        timestamp: new Date().toISOString(),
      });

      // Notify watchers
      const { data: assignments } = await db
        .from('task_assignments')
        .select('assigned_to')
        .eq('task_id', taskId);

      if (assignments && assignments.length > 0) {
        assignments.forEach(async (assignment) => {
          if (assignment.assigned_to !== userId) {
            await db.from('notifications').insert({
              user_id: assignment.assigned_to,
              title: 'New Comment',
              message: `New comment: "${content.substring(0, 50)}..."`,
              type: 'task_commented',
              task_id: taskId,
              action_type: 'commented',
              read: false,
            });

            io.to(`user:${assignment.assigned_to}`).emit('notification:new', {
              type: 'task_commented',
              taskId,
              content,
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ Error handling task:comment:', error);
    }
  });

  socket.on('task:assigned', async (payload) => {
    try {
      const { taskId, projectId, userId, assignedTo, assignedBy } = payload;
      
      console.log(`👤 Task ${taskId} assigned to ${assignedTo}`);

      // Log activity (treated as multi-assignment)
      await db.from('activity_logs').insert({
        user_id: userId,
        task_id: taskId,
        action: 'assigned',
        entity_type: 'assignment',
        entity_id: taskId,
        new_value: { assigned_to: assignedTo },
        metadata: {
          assignedBy,
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast assignment
      io.to(`project:${projectId}:tasks`).emit('task:assigned', {
        taskId,
        projectId,
        assignedTo,
        assignedBy,
        timestamp: new Date().toISOString(),
      });

      // Notify the newly assigned user
      if (assignedTo !== userId) {
        await db.from('notifications').insert({
          user_id: assignedTo,
          title: 'Task Assigned To You',
          message: `You have been assigned a new task`,
          type: 'task_assigned',
          task_id: taskId,
          action_type: 'assigned',
          read: false,
        });

        io.to(`user:${assignedTo}`).emit('notification:new', {
          type: 'task_assigned',
          taskId,
          message: 'You have been assigned a task',
        });
      }
    } catch (error) {
      console.error('❌ Error handling task:assigned:', error);
    }
  });

  socket.on('task:deleted', async (payload) => {
    try {
      const { taskId, projectId, userId } = payload;
      
      console.log(`🗑️ Task ${taskId} deleted from project ${projectId}`);

      // Log activity
      await db.from('activity_logs').insert({
        user_id: userId,
        task_id: taskId,
        action: 'deleted',
        entity_type: 'task',
        entity_id: taskId,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast deletion
      io.to(`project:${projectId}:tasks`).emit('task:deleted', {
        taskId,
        projectId,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Error handling task:deleted:', error);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // DISCONNECTION & CLEANUP
  // ─────────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`✗ User disconnected: ${socket.id}`);

    // Find and remove user from userSockets
    let disconnectedUserId = null;
    for (const [userId, userData] of userSockets.entries()) {
      if (userData.socketId === socket.id) {
        disconnectedUserId = userId;
        userSockets.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      io.emit('user:offline', {
        userId: disconnectedUserId,
        timestamp: new Date().toISOString(),
      });

      // End any active calls for this user
      for (const [callId, callSession] of activeCallSessions.entries()) {
        const isParticipant = callSession.participants.some((p) => p.userId === disconnectedUserId);
        if (isParticipant) {
          io.to(`user:${callSession.initiatorId}`).emit('call:ended', {
            callId,
            endedBy: disconnectedUserId,
            reason: 'user_disconnected',
          });
          activeCallSessions.delete(callId);
        }
      }
    }
  });

  socket.on('error', (error) => {
    console.error(`❌ Socket error: ${socket.id}`, error);
  });
});


// ════════════════════════════════════════════════════════════════════
// Health Check & API Routes
// ════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connectedUsers: userSockets.size,
    activeCalls: activeCallSessions.size,
  });
});

app.post('/api/messages/sync', async (req, res) => {
  try {
    const { userId, conversationIds } = req.body;

    // Sync user with their conversations
    const userData = {
      socketId: null,
      conversationIds: new Set(conversationIds),
      authenticated: false,
      lastSeen: new Date(),
    };

    // Just update conversation list if user exists
    if (userSockets.has(userId)) {
      const existingData = userSockets.get(userId);
      existingData.conversationIds = new Set(conversationIds);
    }

    res.json({ success: true, synced: conversationIds.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// Server Startup
// ════════════════════════════════════════════════════════════════════

const PORT = process.env.SOCKET_PORT || 8001;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  🚀 TaskFlow Real-time Server Started         ║
║  📡 Socket.io listening on port ${PORT}         ║
║  🌐 CORS enabled for all origins              ║
║  📊 Hybrid: Socket.io + database persistence   ║
╚════════════════════════════════════════════════╝
  `);
});

export { io, userSockets, activeCallSessions };
