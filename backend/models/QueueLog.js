const mongoose = require('mongoose');

const QueueLogSchema = new mongoose.Schema({
  tokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Token', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  counterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Counter', default: null },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startTime: { type: Date },
  endTime: { type: Date },
  serviceDuration: { type: Number } // duration in minutes
}, { timestamps: true });

module.exports = mongoose.model('QueueLog', QueueLogSchema);
