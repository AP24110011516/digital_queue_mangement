const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  counterName: { type: String, required: true, unique: true },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activeToken: { type: mongoose.Schema.Types.ObjectId, ref: 'Token', default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
}, { timestamps: true });

module.exports = mongoose.model('Counter', CounterSchema);
