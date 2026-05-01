const express = require('express');
const {
  generateToken,
  getCustomerDashboard,
  getActiveQueue,
  submitFeedback,
} = require('../controllers/queueController');
const { protect, customer } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/generate', protect, customer, generateToken);
router.get('/dashboard', protect, customer, getCustomerDashboard);
router.get('/active', getActiveQueue);
router.post('/feedback', protect, customer, submitFeedback);

module.exports = router;
