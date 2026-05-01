const express = require('express');
const {
  getOverview,
  acceptToken,
  updateServiceDuration,
  completeToken,
} = require('../controllers/staffController');
const { protect, agent } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/overview', protect, agent, getOverview);
router.put('/tokens/:id/accept', protect, agent, acceptToken);
router.put('/tokens/:id/duration', protect, agent, updateServiceDuration);
router.put('/tokens/:id/complete', protect, agent, completeToken);

module.exports = router;
