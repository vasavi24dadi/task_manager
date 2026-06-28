require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { initDb } = require('./db');
const api = require('./routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.VITE_API_BASE || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Store active connections
const activeUsers = new Map(); // userId -> socket.id

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('[Socket.IO] User connected:', socket.id);

  // User comes online
  socket.on('user:online', (userId) => {
    activeUsers.set(userId, socket.id);
    io.emit('user:status', { userId, status: 'online' });
    console.log(`[Socket.IO] User ${userId} marked online`);
  });

  // User goes offline
  socket.on('disconnect', () => {
    for (const [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        activeUsers.delete(userId);
        io.emit('user:status', { userId, status: 'offline' });
        console.log(`[Socket.IO] User ${userId} marked offline`);
        break;
      }
    }
    console.log('[Socket.IO] User disconnected:', socket.id);
  });

  // Chat messages
  socket.on('message:send', (data) => {
    const { conversationId, content, senderId } = data;
    io.emit('message:new', { conversationId, content, senderId, timestamp: new Date() });
  });

  // Typing indicator
  socket.on('typing:start', (data) => {
    socket.broadcast.emit('typing:active', data);
  });

  socket.on('typing:stop', (data) => {
    socket.broadcast.emit('typing:inactive', data);
  });

  // Call events
  socket.on('call:initiate', (data) => {
    const { fromUserId, toUserId, callType } = data;
    const targetSocketId = activeUsers.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:incoming', { fromUserId, callType });
    }
  });

  socket.on('call:accept', (data) => {
    io.emit('call:accepted', data);
  });

  socket.on('call:reject', (data) => {
    const { toUserId } = data;
    const targetSocketId = activeUsers.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:rejected', data);
    }
  });

  socket.on('call:end', (data) => {
    io.emit('call:ended', data);
  });

  // WebRTC signaling
  socket.on('webrtc:offer', (data) => {
    io.emit('webrtc:offer', data);
  });

  socket.on('webrtc:answer', (data) => {
    io.emit('webrtc:answer', data);
  });

  socket.on('webrtc:ice-candidate', (data) => {
    io.emit('webrtc:ice-candidate', data);
  });

  // Notification events
  socket.on('notification:read', (notificationId) => {
    io.emit('notification:marked-read', notificationId);
  });
});

// API Routes
app.use('/api', api);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const port = process.env.PORT || 4000;

initDb().then(() => {
  server.listen(port, () => {
    console.log(`✓ Backend server listening on http://localhost:${port}`);
    console.log(`✓ Socket.IO running on ws://localhost:${port}`);
  });
}).catch(err => {
  console.error('✗ Failed to initialize DB', err);
  process.exit(1);
});
