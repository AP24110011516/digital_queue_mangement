const Counter = require('../models/Counter');
const Token = require('../models/Token');
const User = require('../models/User');
const {
  assignTokenToCounter,
  reassignToken,
  getAdminDashboardData,
} = require('../services/queueService');

// Seed bank service counters on startup
const seedDefaultCounters = async () => {
  const defaults = [
    'Deposit Counter',
    'Withdrawal Counter',
    'Loan Counter',
    'Account Opening Counter',
    'General Enquiry Counter',
  ];
  for (const name of defaults) {
    const exists = await Counter.findOne({ counterName: name });
    if (!exists) await Counter.create({ counterName: name });
  }
};
seedDefaultCounters().catch((e) => console.error('Counter seed error:', e));

const createCounter = async (req, res) => {
  try {
    const { counterName } = req.body;
    if (await Counter.findOne({ counterName })) {
      return res.status(400).json({ message: 'Counter already exists' });
    }
    const counter = await Counter.create({ counterName });
    res.status(201).json(counter);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

const getCounters = async (req, res) => {
  try {
    const counters = await Counter.find()
      .populate('assignedAgent', 'name email')
      .populate('activeToken', 'tokenNumber status');
    res.json(counters);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

const assignAgent = async (req, res) => {
  try {
    const { agentId } = req.body;
    const counter = await Counter.findById(req.params.id);
    if (!counter) return res.status(404).json({ message: 'Counter not found' });

    if (!agentId) {
      if (counter.assignedAgent) {
        await User.findByIdAndUpdate(counter.assignedAgent, { assignedCounter: null });
      }
      counter.assignedAgent = null;
      counter.status = 'inactive';
      await counter.save();
      return res.json(counter);
    }

    const agentUser = await User.findOne({ _id: agentId, role: 'agent' });
    if (!agentUser) return res.status(404).json({ message: 'Agent not found.' });

    if (agentUser.assignedCounter?.toString() !== counter._id.toString()) {
      if (agentUser.assignedCounter) {
        await Counter.findByIdAndUpdate(agentUser.assignedCounter, {
          assignedAgent: null, status: 'inactive',
        });
      }
    }

    if (counter.assignedAgent?.toString() !== agentId) {
      if (counter.assignedAgent) {
        await User.findByIdAndUpdate(counter.assignedAgent, { assignedCounter: null });
      }
    }

    agentUser.assignedCounter = counter._id;
    await agentUser.save();
    counter.assignedAgent = agentId;
    counter.status = 'active';
    await counter.save();
    res.json(counter);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

const toggleCounter = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    if (!counter) return res.status(404).json({ message: 'Counter not found' });
    counter.status = counter.status === 'active' ? 'inactive' : 'active';
    await counter.save();
    res.json(counter);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin assigns a waiting token to a counter
const assignToken = async (req, res) => {
  try {
    const { counterId } = req.body;
    const token = await assignTokenToCounter({
      tokenId: req.params.id,
      counterId,
      io: req.app.get('io'),
    });
    res.json(token);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Server error' });
  }
};

// Admin reassigns an already-assigned token to a different counter
const reassignTokenRoute = async (req, res) => {
  try {
    const { counterId } = req.body;
    const token = await reassignToken({
      tokenId: req.params.id,
      counterId,
      io: req.app.get('io'),
    });
    res.json(token);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Server error' });
  }
};

const getDashboard = async (req, res) => {
  try {
    res.json(await getAdminDashboardData());
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createCounter,
  getCounters,
  assignAgent,
  toggleCounter,
  assignToken,
  reassignTokenRoute,
  getDashboard,
};
