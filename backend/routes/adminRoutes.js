const express = require('express');
const {
  createCounter,
  getCounters,
  assignAgent,
  toggleCounter,
  assignToken,
  reassignTokenRoute,
  getDashboard,
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', protect, admin, getDashboard);
router.post('/counters', protect, admin, createCounter);
router.get('/counters', protect, getCounters);
router.put('/counters/:id/assign', protect, admin, assignAgent);
router.put('/counters/:id/toggle', protect, admin, toggleCounter);
router.put('/tokens/:id/assign', protect, admin, assignToken);
router.put('/tokens/:id/reassign', protect, admin, reassignTokenRoute);

module.exports = router;
