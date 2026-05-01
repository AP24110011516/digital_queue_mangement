const Feedback = require('../models/Feedback');
const Token = require('../models/Token');
const {
  PRIORITY_WEIGHTS,
  SERVICE_TYPES,
  createTokenForCustomer,
  getActiveQueueSnapshot,
  getCustomerDashboardSnapshot,
} = require('../services/queueService');

const generateToken = async (req, res) => {
  try {
    const { serviceType = 'general_enquiry', priorityType = 'normal' } = req.body;
    if (!SERVICE_TYPES.includes(serviceType)) {
      return res.status(400).json({ message: 'Invalid service type.' });
    }
    await createTokenForCustomer({
      userId: req.user._id,
      serviceType,
      priorityType,
      io: req.app.get('io'),
    });
    const dashboard = await getCustomerDashboardSnapshot(req.user._id);
    return res.status(201).json(dashboard);
  } catch (e) {
    const code = e.message === 'You already have an active token.' ? 400 : 500;
    return res.status(code).json({ message: e.message || 'Server error' });
  }
};

const getCustomerDashboard = async (req, res) => {
  try {
    res.json(await getCustomerDashboardSnapshot(req.user._id));
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getActiveQueue = async (req, res) => {
  try {
    res.json(await getActiveQueueSnapshot());
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
};

const submitFeedback = async (req, res) => {
  try {
    const { tokenId, rating, comment } = req.body;
    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    const token = await Token.findOne({
      _id: tokenId,
      customerId: req.user._id,
      status: 'completed',
    }).populate('counterId', 'counterName assignedAgent');

    if (!token) return res.status(404).json({ message: 'Completed token not found.' });
    if (await Feedback.findOne({ tokenId })) {
      return res.status(400).json({ message: 'Feedback already submitted.' });
    }

    await Feedback.create({
      customerId: req.user._id,
      tokenId,
      agentId: token.counterId?.assignedAgent || null,
      counterId: token.counterId?._id || null,
      rating: numericRating,
      comment,
    });

    token.feedbackSubmitted = true;
    await token.save();

    const io = req.app.get('io');
    if (io) io.emit('feedback_submitted', { tokenId: token._id.toString(), rating: numericRating });

    return res.status(201).json(await getCustomerDashboardSnapshot(req.user._id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Unable to save feedback.' });
  }
};

module.exports = { generateToken, getCustomerDashboard, getActiveQueue, submitFeedback };
