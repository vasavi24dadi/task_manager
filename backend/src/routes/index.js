const express = require('express');
const router = express.Router();

// API Routes
router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/projects', require('./projects'));
router.use('/tasks', require('./tasks'));
router.use('/teams', require('./teams'));
router.use('/notifications', require('./notifications-api'));
router.use('/attendance', require('./attendance'));
router.use('/performance', require('./performance'));
router.use('/announcements', require('./announcements'));
router.use('/dashboard', require('./dashboard'));
router.use('/leaves', require('./leaves'));
router.use('/chats', require('./chats-api'));
router.use('/messages', require('./chats-api')); // Messages under /api/messages prefix
router.use('/meetings', require('./meetings-api'));
router.use('/calls', require('./meetings-api')); // Call history
router.use('/files', require('./files'));
router.use('/reports', require('./reports'));

// Health check
router.get('/', (req, res) => res.json({ ok: true, version: '1.0.0' }));

module.exports = router;
