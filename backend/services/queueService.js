const Counter = require('../models/Counter');
const Feedback = require('../models/Feedback');
const QueueLog = require('../models/QueueLog');
const Sequence = require('../models/Sequence');
const Token = require('../models/Token');
const User = require('../models/User');

const PRIORITY_WEIGHTS = { emergency: 3, senior: 2, normal: 1 };
const DEFAULT_AVG_MINUTES = Number(process.env.DEFAULT_AVG_SERVICE_MINUTES || 6);
const TURN_APPROACHING_THRESHOLD = 2; // notify when this many people ahead

// ─── Bank service config ──────────────────────────────────────────────────────
const SERVICE_TYPES = ['deposit', 'withdrawal', 'loan', 'account_opening', 'general_enquiry'];

const SERVICE_PREFIX = {
  deposit:          'D',
  withdrawal:       'W',
  loan:             'L',
  account_opening:  'A',
  general_enquiry:  'G',
};

const SERVICE_LABEL = {
  deposit:          'Deposit',
  withdrawal:       'Withdrawal',
  loan:             'Loan Services',
  account_opening:  'Account Opening',
  general_enquiry:  'General Enquiry',
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const priorityLabel = (p) => {
  if (p === 'emergency') return 'Emergency';
  if (p === 'senior') return 'Senior Citizen';
  return 'Normal';
};

const sortByPriority = (tokens) =>
  [...tokens].sort((a, b) => {
    const diff = PRIORITY_WEIGHTS[b.priorityType] - PRIORITY_WEIGHTS[a.priorityType];
    return diff !== 0 ? diff : new Date(a.createdAt) - new Date(b.createdAt);
  });

// ─── QR payload ───────────────────────────────────────────────────────────────
const buildQrPayload = (token, customerName, counterName) =>
  JSON.stringify({
    tokenNumber: token.tokenNumber,
    customerName: customerName || 'Customer',
    serviceType: SERVICE_LABEL[token.serviceType] || token.serviceType,
    counter: counterName || 'Unassigned',
    status: token.status,
  });

// ─── Notification messages ────────────────────────────────────────────────────
const notificationMessage = (type, token, extra = {}) => {
  const counter = extra.counterName || token.counterId?.counterName || 'your counter';
  const service = SERVICE_LABEL[token.serviceType] || 'Service';
  switch (type) {
    case 'token_generated':
      return `Token ${token.tokenNumber} generated for ${service}. Please wait.`;
    case 'token_assigned':
      return `Token ${token.tokenNumber} assigned to ${counter}. Please proceed when called.`;
    case 'turn_approaching':
      return `Your turn is approaching at ${counter}. Please be ready.`;
    case 'token_accepted':
      return `Proceed to ${counter} — your ${service} service has started.`;
    case 'service_time_updated':
      return `Estimated wait updated to ${extra.estimatedWaitMinutes ?? 0} min.`;
    case 'service_completed':
      return `Service completed at ${counter}. Thank you for banking with us.`;
    case 'feedback_requested':
      return `Please rate your ${service} experience.`;
    default:
      return extra.message || 'Queue updated.';
  }
};

const pushNotification = async (token, io, type, extra = {}) => {
  const message = notificationMessage(type, token, extra);
  token.notificationHistory = (token.notificationHistory || []).slice(-11);
  const counterName = extra.counterName || token.counterId?.counterName || 'your counter';
  token.notificationHistory.push({
    type,
    message,
    tokenNumber: token.tokenNumber,
    counterName,
    createdAt: new Date()
  });
  await token.save();
  io.to(`user:${token.customerId.toString()}`).emit('customer_notification', {
    tokenId: token._id.toString(),
    type,
    message,
    tokenNumber: token.tokenNumber,
    counterName,
    createdAt: new Date().toISOString(),
  });
};

// ─── Format token for API responses ──────────────────────────────────────────
const formatToken = (token, extra = {}) => ({
  _id: token._id,
  tokenNumber: token.tokenNumber,
  serviceType: token.serviceType,
  serviceLabel: SERVICE_LABEL[token.serviceType] || token.serviceType,
  priorityType: token.priorityType,
  status: token.status,
  createdAt: token.createdAt,
  assignedAt: token.assignedAt,
  acceptedAt: token.acceptedAt,
  completedAt: token.completedAt,
  serviceDurationMinutes: token.serviceDurationMinutes,
  serviceDuration: token.serviceDuration,
  counterId: token.counterId?._id || token.counterId || null,
  counterName: token.counterId?.counterName || null,
  customerId: token.customerId?._id || token.customerId || null,
  customerName: token.customerId?.name || 'Customer',
  estimatedWaitMinutes: extra.estimatedWaitMinutes ?? token.estimatedWaitMinutes ?? 0,
  queuePosition: extra.queuePosition ?? token.lastKnownPosition ?? null,
  peopleAhead: extra.peopleAhead ?? Math.max((token.lastKnownPosition || 1) - 1, 0),
  qrPayload: buildQrPayload(
    token,
    token.customerId?.name || 'Customer',
    token.counterId?.counterName || null,
  ),
});

// ─── Wait time: sum of durations of tokens ahead ──────────────────────────────
const calcWaitForPosition = (tokensAhead) =>
  tokensAhead.reduce((sum, t) => sum + (t.serviceDurationMinutes || DEFAULT_AVG_MINUTES), 0);

// ─── Queue snapshot ───────────────────────────────────────────────────────────
const getActiveQueueSnapshot = async () => {
  const [activeTokens, assignedTokens, waitingTokens] = await Promise.all([
    Token.find({ status: 'active' })
      .populate('customerId', 'name email')
      .populate('counterId', 'counterName')
      .sort({ acceptedAt: 1 }),
    Token.find({ status: 'assigned' })
      .populate('customerId', 'name email')
      .populate('counterId', 'counterName')
      .sort({ assignedAt: 1 }),
    Token.find({ status: 'waiting' })
      .populate('customerId', 'name email')
      .sort({ createdAt: 1 }),
  ]);

  const sortedWaiting = sortByPriority(waitingTokens);

  const waitingSnapshot = sortedWaiting.map((t, i) => formatToken(t, {
    queuePosition: i + 1,
    peopleAhead: i,
    estimatedWaitMinutes: calcWaitForPosition(sortedWaiting.slice(0, i)),
  }));

  return {
    activeTokens: activeTokens.map((t) => formatToken(t)),
    assignedTokens: assignedTokens.map((t) => formatToken(t)),
    waitingTokens: waitingSnapshot,
    allTokens: [
      ...activeTokens.map((t) => formatToken(t)),
      ...assignedTokens.map((t) => formatToken(t)),
      ...waitingSnapshot,
    ],
  };
};

// ─── Sync waiting queue — notify customers of position & turn approaching ─────
const syncWaitingQueue = async (io) => {
  const waitingTokens = await Token.find({ status: 'waiting' })
    .populate('customerId', 'name email')
    .sort({ createdAt: 1 });

  const sorted = sortByPriority(waitingTokens);

  for (let i = 0; i < sorted.length; i++) {
    const token = sorted[i];
    const queuePosition = i + 1;
    const peopleAhead = i;
    const estimatedWaitMinutes = calcWaitForPosition(sorted.slice(0, i));

    token.lastKnownPosition = queuePosition;
    token.estimatedWaitMinutes = estimatedWaitMinutes;
    await token.save();

    io.to(`user:${token.customerId._id.toString()}`).emit('queue_state', {
      queuePosition,
      peopleAhead,
      estimatedWaitMinutes,
    });

    // turn_approaching notification
    if (peopleAhead <= TURN_APPROACHING_THRESHOLD && peopleAhead > 0) {
      const counterName = token.counterId?.counterName || 'your counter';
      io.to(`user:${token.customerId._id.toString()}`).emit('customer_notification', {
        tokenId: token._id.toString(),
        type: 'turn_approaching',
        message: notificationMessage('turn_approaching', token, { counterName }),
        tokenNumber: token.tokenNumber,
        counterName,
        createdAt: new Date().toISOString(),
      });
      io.emit('turn_approaching', { tokenId: token._id.toString(), peopleAhead });
    }
  }

  io.emit('queue_updated');
};

// ─── Sync counter queue wait times ───────────────────────────────────────────
const syncCounterQueue = async (counterId, io) => {
  const tokens = await Token.find({ counterId, status: 'assigned' })
    .populate('customerId', 'name email')
    .populate('counterId', 'counterName')
    .sort({ assignedAt: 1 });

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const estimatedWaitMinutes = calcWaitForPosition(tokens.slice(0, i));
    token.estimatedWaitMinutes = estimatedWaitMinutes;
    await token.save();

    const counterName = token.counterId?.counterName || 'your counter';
    io.to(`user:${token.customerId._id.toString()}`).emit('service_time_updated', {
      tokenId: token._id.toString(),
      estimatedWaitMinutes,
    });
    io.to(`user:${token.customerId._id.toString()}`).emit('customer_notification', {
      tokenId: token._id.toString(),
      type: 'service_time_updated',
      message: notificationMessage('service_time_updated', token, { estimatedWaitMinutes, counterName }),
      tokenNumber: token.tokenNumber,
      counterName,
      createdAt: new Date().toISOString(),
    });
  }

  io.emit('service_time_updated', { counterId: counterId.toString() });
};

// ─── Token number generator — atomic per service type per day ─────────────────
const generateTokenNumber = async (serviceType) => {
  const today = new Date().toISOString().slice(0, 10);
  const seqId = `${serviceType}:${today}`;

  const result = await Sequence.findOneAndUpdate(
    { _id: seqId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );

  const prefix = SERVICE_PREFIX[serviceType] || 'G';
  return `${prefix}-${String(result.seq).padStart(3, '0')}`;
};

// ─── CUSTOMER: generate token ─────────────────────────────────────────────────
const createTokenForCustomer = async ({ userId, serviceType = 'general_enquiry', priorityType = 'normal', io }) => {
  if (!SERVICE_TYPES.includes(serviceType)) throw new Error('Invalid service type.');

  const existing = await Token.findOne({
    customerId: userId,
    status: { $in: ['waiting', 'assigned', 'active'] },
  });
  if (existing) throw new Error('You already have an active token.');

  const tokenNumber = await generateTokenNumber(serviceType);

  const token = await Token.create({
    tokenNumber,
    customerId: userId,
    serviceType,
    priorityType,
    status: 'waiting',
  });

  const customer = await User.findById(userId).select('email name');
  await pushNotification(token, io, 'token_generated');

  io.emit('token_generated', {
    tokenId: token._id.toString(),
    tokenNumber: token.tokenNumber,
    serviceType: token.serviceType,
    serviceLabel: SERVICE_LABEL[token.serviceType],
    priorityType: token.priorityType,
  });
  io.emit('queue_updated');

  await syncWaitingQueue(io);
  return token;
};

// ─── ADMIN: assign token to counter ──────────────────────────────────────────
const assignTokenToCounter = async ({ tokenId, counterId, io }) => {
  const token = await Token.findOne({ _id: tokenId, status: 'waiting' })
    .populate('customerId', 'name email')
    .populate('counterId', 'counterName');

  if (!token) throw new Error('Token not found or not in waiting state.');

  const counter = await Counter.findById(counterId);
  if (!counter) throw new Error('Counter not found.');

  token.counterId = counter._id;
  token.status = 'assigned';
  token.assignedAt = new Date();
  await token.save();

  await token.populate('counterId', 'counterName');
  await pushNotification(token, io, 'token_assigned', { counterName: counter.counterName });

  io.emit('token_assigned', {
    tokenId: token._id.toString(),
    tokenNumber: token.tokenNumber,
    serviceType: token.serviceType,
    counterId: counter._id.toString(),
    counterName: counter.counterName,
  });

  await syncWaitingQueue(io);
  await syncCounterQueue(counter._id, io);
  return formatToken(token);
};

// ─── ADMIN: reassign token ────────────────────────────────────────────────────
const reassignToken = async ({ tokenId, counterId, io }) => {
  const token = await Token.findOne({ _id: tokenId, status: 'assigned' })
    .populate('customerId', 'name email')
    .populate('counterId', 'counterName');

  if (!token) throw new Error('Token not found or not in assigned state.');

  const oldCounterId = token.counterId?._id;
  const counter = await Counter.findById(counterId);
  if (!counter) throw new Error('Counter not found.');

  token.counterId = counter._id;
  token.assignedAt = new Date();
  await token.save();

  await token.populate('counterId', 'counterName');
  await pushNotification(token, io, 'token_assigned', { counterName: counter.counterName });

  io.emit('token_assigned', {
    tokenId: token._id.toString(),
    tokenNumber: token.tokenNumber,
    serviceType: token.serviceType,
    counterId: counter._id.toString(),
    counterName: counter.counterName,
  });

  if (oldCounterId) await syncCounterQueue(oldCounterId, io);
  await syncCounterQueue(counter._id, io);
  return formatToken(token);
};

// ─── COUNTER STAFF: accept token ─────────────────────────────────────────────
const acceptTokenByStaff = async ({ tokenId, staffId, io }) => {
  const token = await Token.findOne({ _id: tokenId, status: 'assigned' })
    .populate('customerId', 'name email')
    .populate('counterId', 'counterName assignedAgent');

  if (!token) throw new Error('Token not found or not assigned.');

  if (token.counterId?.assignedAgent?.toString() !== staffId.toString()) {
    throw new Error('This token is not assigned to your counter.');
  }

  const alreadyActive = await Token.findOne({ counterId: token.counterId._id, status: 'active' });
  if (alreadyActive) throw new Error('Complete the current active token first.');

  const now = new Date();
  token.status = 'active';
  token.acceptedAt = now;
  token.serviceStartTime = now;
  await token.save();

  await pushNotification(token, io, 'token_accepted', {
    counterName: token.counterId.counterName,
  });

  io.emit('token_accepted', {
    tokenId: token._id.toString(),
    tokenNumber: token.tokenNumber,
    serviceType: token.serviceType,
    counterName: token.counterId.counterName,
  });

  io.emit('service_started', {
    tokenId: token._id.toString(),
    tokenNumber: token.tokenNumber,
    serviceType: token.serviceType,
    counterName: token.counterId.counterName,
    serviceStartTime: now.toISOString(),
  });

  await syncCounterQueue(token.counterId._id, io);
  return formatToken(token);
};

// ─── COUNTER STAFF: set service duration ─────────────────────────────────────
const setServiceDuration = async ({ tokenId, staffId, durationMinutes, io }) => {
  const token = await Token.findOne({ _id: tokenId, status: 'active' })
    .populate('customerId', 'name email')
    .populate('counterId', 'counterName assignedAgent');

  if (!token) throw new Error('Active token not found.');

  if (token.counterId?.assignedAgent?.toString() !== staffId.toString()) {
    throw new Error('This token is not at your counter.');
  }

  token.serviceDurationMinutes = Number(durationMinutes);
  await token.save();

  await syncCounterQueue(token.counterId._id, io);

  io.emit('service_time_updated', {
    tokenId: token._id.toString(),
    tokenNumber: token.tokenNumber,
    serviceDurationMinutes: token.serviceDurationMinutes,
  });

  return formatToken(token);
};

// ─── COUNTER STAFF: complete service ─────────────────────────────────────────
const completeTokenService = async ({ tokenId, staffId, io }) => {
  const token = await Token.findOne({ _id: tokenId, status: 'active' })
    .populate('customerId', 'name email')
    .populate('counterId', 'counterName assignedAgent');

  if (!token) throw new Error('Active token not found.');

  if (token.counterId?.assignedAgent?.toString() !== staffId.toString()) {
    throw new Error('This token is not at your counter.');
  }

  const completedAt = new Date();
  const startTime = token.serviceStartTime || token.acceptedAt || token.createdAt;
  const serviceDuration = Number((((completedAt - startTime) / 60_000) || 0).toFixed(2));

  token.status = 'completed';
  token.completedAt = completedAt;
  token.serviceEndTime = completedAt;
  token.serviceDuration = serviceDuration;
  await token.save();

  await QueueLog.create({
    tokenId: token._id,
    customerId: token.customerId._id,
    counterId: token.counterId?._id || null,
    agentId: staffId,
    startTime,
    endTime: completedAt,
    serviceDuration,
  });

  await pushNotification(token, io, 'service_completed', {
    counterName: token.counterId?.counterName,
  });

  await pushNotification(token, io, 'feedback_requested', {
    counterName: token.counterId?.counterName,
  });

  io.emit('service_completed', {
    tokenId: token._id.toString(),
    tokenNumber: token.tokenNumber,
    serviceType: token.serviceType,
    customerId: token.customerId._id.toString(),
    serviceDuration,
    counterId: token.counterId?._id?.toString(),
  });

  io.emit('analytics_updated', { counterId: token.counterId?._id?.toString() });

  await syncCounterQueue(token.counterId._id, io);
  await syncWaitingQueue(io);
  return token;
};

// ─── CUSTOMER dashboard snapshot ─────────────────────────────────────────────
const getCustomerDashboardSnapshot = async (customerId) => {
  const [activeToken, feedbackPendingToken, snapshot] = await Promise.all([
    Token.findOne({ customerId, status: { $in: ['waiting', 'assigned', 'active'] } })
      .populate('customerId', 'name email')
      .populate('counterId', 'counterName')
      .sort({ createdAt: -1 }),
    Token.findOne({ customerId, status: 'completed', feedbackSubmitted: false })
      .populate('counterId', 'counterName')
      .sort({ completedAt: -1 }),
    getActiveQueueSnapshot(),
  ]);

  let activeTokenPayload = null;
  if (activeToken) {
    if (activeToken.status === 'waiting') {
      const meta = snapshot.waitingTokens.find(
        (t) => t._id.toString() === activeToken._id.toString(),
      );
      activeTokenPayload = {
        ...formatToken(activeToken, meta || {}),
        notificationHistory: activeToken.notificationHistory || [],
      };
    } else {
      activeTokenPayload = {
        ...formatToken(activeToken),
        notificationHistory: activeToken.notificationHistory || [],
      };
    }
  }

  return {
    activeToken: activeTokenPayload,
    feedbackPendingToken: feedbackPendingToken ? {
      _id: feedbackPendingToken._id,
      tokenNumber: feedbackPendingToken.tokenNumber,
      serviceLabel: SERVICE_LABEL[feedbackPendingToken.serviceType] || 'Service',
      counterName: feedbackPendingToken.counterId?.counterName || null,
      completedAt: feedbackPendingToken.completedAt,
    } : null,
    notificationHistory:
      activeTokenPayload?.notificationHistory ||
      feedbackPendingToken?.notificationHistory ||
      [],
  };
};

// ─── COUNTER STAFF overview ───────────────────────────────────────────────────
const getStaffOverview = async (staffId) => {
  const myCounter = await Counter.findOne({ assignedAgent: staffId })
    .populate('assignedAgent', 'name email');

  if (!myCounter) return { myCounter: null, activeToken: null, assignedTokens: [] };

  const [activeToken, assignedTokens] = await Promise.all([
    Token.findOne({ counterId: myCounter._id, status: 'active' })
      .populate('customerId', 'name email')
      .populate('counterId', 'counterName'),
    Token.find({ counterId: myCounter._id, status: 'assigned' })
      .populate('customerId', 'name email')
      .populate('counterId', 'counterName')
      .sort({ assignedAt: 1 }),
  ]);

  return {
    myCounter,
    activeToken: activeToken ? formatToken(activeToken) : null,
    assignedTokens: assignedTokens.map((t) => formatToken(t)),
  };
};

// ─── ADMIN dashboard data ─────────────────────────────────────────────────────
const getAdminDashboardData = async () => {
  const todayStart = startOfToday();

  const [
    counters, agents, snapshot,
    totalServedToday, recentFeedback, feedbackCount, feedbackAvg,
    agentRatings, serviceBreakdown, peakHours,
    counterServedToday, counterAvgDuration,
  ] = await Promise.all([
    Counter.find()
      .populate('assignedAgent', 'name email')
      .populate('activeToken', 'tokenNumber status serviceType'),
    User.find({ role: 'agent' }).select('-password').populate('assignedCounter', 'counterName'),
    getActiveQueueSnapshot(),
    Token.countDocuments({ status: 'completed', completedAt: { $gte: todayStart } }),
    Feedback.find().sort({ createdAt: -1 }).limit(8)
      .populate('customerId', 'name')
      .populate('agentId', 'name')
      .populate('counterId', 'counterName'),
    Feedback.countDocuments({ createdAt: { $gte: todayStart } }),
    Feedback.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: null, value: { $avg: '$rating' } } },
    ]),
    Feedback.aggregate([
      { $group: { _id: '$agentId', avg: { $avg: '$rating' }, total: { $sum: 1 } } },
      { $sort: { avg: -1 } }, { $limit: 6 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
    ]),
    // Service type breakdown instead of priority breakdown
    Token.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: '$serviceType', total: { $sum: 1 } } },
    ]),
    QueueLog.aggregate([
      { $match: { endTime: { $gte: todayStart } } },
      { $project: { hour: { $hour: '$endTime' } } },
      { $group: { _id: '$hour', total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    QueueLog.aggregate([
      { $match: { startTime: { $gte: todayStart } } },
      { $group: { _id: '$counterId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $lookup: { from: 'counters', localField: '_id', foreignField: '_id', as: 'counter' } },
      { $unwind: { path: '$counter', preserveNullAndEmptyArrays: true } },
    ]),
    QueueLog.aggregate([
      { $match: { startTime: { $gte: todayStart }, serviceDuration: { $gt: 0 } } },
      { $group: { _id: '$counterId', avgDuration: { $avg: '$serviceDuration' }, total: { $sum: 1 } } },
      { $lookup: { from: 'counters', localField: '_id', foreignField: '_id', as: 'counter' } },
      { $unwind: { path: '$counter', preserveNullAndEmptyArrays: true } },
    ]),
  ]);

  const averageRating = Number((feedbackAvg[0]?.value || 0).toFixed(1));
  const bestAgent = agentRatings[0];
  const peakHour = peakHours.reduce((b, c) => (!b || c.total > b.total ? c : b), null);
  const bestCounter = counterServedToday[0];

  return {
    counters,
    agents,
    waitingTokens: snapshot.waitingTokens,
    assignedTokens: snapshot.assignedTokens,
    activeTokens: snapshot.activeTokens,
    analytics: {
      totalServedToday,
      waitingCount: snapshot.waitingTokens.length,
      assignedCount: snapshot.assignedTokens.length,
      activeCount: snapshot.activeTokens.length,
      averageRating,
      peakServiceHour: peakHour ? { hour: peakHour._id, total: peakHour.total } : null,
      bestCounter: bestCounter
        ? { name: bestCounter.counter?.counterName || 'Counter', total: bestCounter.total }
        : null,
      bestAgent: bestAgent
        ? { name: bestAgent.agent?.name || 'Agent', rating: Number(bestAgent.avg.toFixed(1)) }
        : null,
    },
    charts: {
      hourlyTraffic: peakHours.map((e) => ({
        label: `${String(e._id).padStart(2, '0')}:00`,
        value: e.total,
        hour: e._id,
      })),
      // Service type breakdown
      serviceBreakdown: SERVICE_TYPES.map((s) => ({
        label: SERVICE_LABEL[s],
        value: serviceBreakdown.find((x) => x._id === s)?.total || 0,
      })),
      agentRatings: agentRatings.map((e) => ({
        label: e.agent?.name || 'Unknown',
        value: Number(e.avg.toFixed(1)),
      })),
      counterServed: counterServedToday.map((e) => ({
        label: e.counter?.counterName || 'Unknown',
        value: e.total,
      })),
      counterAvgDuration: counterAvgDuration.map((e) => ({
        label: e.counter?.counterName || 'Unknown',
        value: Number(e.avgDuration.toFixed(1)),
      })),
      counterStatus: [
        { label: 'Active', value: counters.filter((c) => c.status === 'active').length },
        { label: 'Inactive', value: counters.filter((c) => c.status === 'inactive').length },
      ],
    },
    feedbackInsights: {
      averageRating,
      totalFeedbackCount: feedbackCount,
      recentFeedback: recentFeedback.map((f) => ({
        id: f._id,
        customerName: f.customerId?.name || 'Customer',
        agentName: f.agentId?.name || 'Staff',
        counterName: f.counterId?.counterName || 'Counter',
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
      })),
    },
  };
};

const expireStaleTokens = async () => {};

module.exports = {
  PRIORITY_WEIGHTS,
  SERVICE_TYPES,
  SERVICE_LABEL,
  SERVICE_PREFIX,
  buildQrPayload,
  createTokenForCustomer,
  assignTokenToCounter,
  reassignToken,
  acceptTokenByStaff,
  setServiceDuration,
  completeTokenService,
  expireStaleTokens,
  getActiveQueueSnapshot,
  getAdminDashboardData,
  getCustomerDashboardSnapshot,
  getStaffOverview,
};
