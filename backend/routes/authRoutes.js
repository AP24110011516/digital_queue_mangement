const express = require('express');
const { login, register, getAgents, checkAdmin, getMe } = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/agents', protect, admin, getAgents);
router.get('/check-admin', checkAdmin);

module.exports = router;
