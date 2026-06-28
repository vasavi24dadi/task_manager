const express = require('express');
const router = express.Router();

// Simple route structure. We'll import modules per resource.
router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/projects', require('./projects'));
router.use('/tasks', require('./tasks'));
router.use('/teams', require('./teams'));
router.use('/notifications', require('./notifications'));
router.use('/attendance', require('./attendance'));
router.use('/performance', require('./performance'));
router.use('/announcements', require('./announcements'));
router.use('/dashboard', require('./dashboard'));
router.use('/leaves', require('./leaves'));
router.use('/chats', require('./chats'));
router.use('/meetings', require('./meetings'));
router.use('/files', require('./files'));

router.get('/', (req, res) => res.json({ ok: true }));

module.exports = router;
