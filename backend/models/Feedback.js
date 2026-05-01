const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Token', required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  counterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Counter', default: null },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

FeedbackSchema.index({ tokenId: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);
