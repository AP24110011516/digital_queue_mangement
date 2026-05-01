const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const TokenSchema = new mongoose.Schema({
  tokenNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  counterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Counter', default: null },
  // Bank service type — drives token prefix and counter routing
  serviceType: {
    type: String,
    enum: ['deposit', 'withdrawal', 'loan', 'account_opening', 'general_enquiry'],
    default: 'general_enquiry',
  },
  priorityType: { type: String, enum: ['normal', 'senior', 'emergency'], default: 'normal' },
  // Full lifecycle: waiting → assigned → active → completed | expired
  status: {
    type: String,
    enum: ['waiting', 'assigned', 'active', 'completed', 'expired'],
    default: 'waiting',
  },
  assignedAt:  { type: Date, default: null },
  acceptedAt:  { type: Date, default: null },
  completedAt: { type: Date, default: null },
  serviceStartTime:       { type: Date,   default: null },
  serviceEndTime:         { type: Date,   default: null },
  serviceDuration:        { type: Number, default: null },
  serviceDurationMinutes: { type: Number, default: null },
  estimatedWaitMinutes:   { type: Number, default: 0 },
  lastKnownPosition:      { type: Number, default: null },
  feedbackSubmitted:      { type: Boolean, default: false },
  notificationHistory:    { type: [NotificationSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Token', TokenSchema);
