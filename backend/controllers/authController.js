const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  assignedCounter: user.assignedCounter || null,
  token: generateToken(user._id),
});

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    return res.json(serializeUser(user));
  }

  return res.status(401).json({ message: 'Invalid email or password' });
};

const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const userRole = role || 'customer';
  
  if (userRole === 'admin') {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(403).json({ message: 'An admin already exists. Cannot register a new admin.' });
    }
  }

  const user = await User.create({
    name,
    email,
    password,
    role: userRole,
  });

  if (user) {
    return res.status(201).json(serializeUser(user));
  }

  return res.status(400).json({ message: 'Invalid user data' });
};

const getAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' })
      .select('-password')
      .populate('assignedCounter', 'counterName');
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const checkAdmin = async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    res.json({ exists: !!adminExists });
  } catch (error) {
    res.status(500).json({ message: 'Server error check admin' });
  }
};

const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('assignedCounter', 'counterName');

  return res.json(user);
};

module.exports = { login, register, getAgents, checkAdmin, getMe };
