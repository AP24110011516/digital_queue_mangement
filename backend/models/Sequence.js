const mongoose = require('mongoose');

// Atomic sequence counter per service type per day.
// _id format: "deposit:2026-04-26", "withdrawal:2026-04-26", etc.
const SequenceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Sequence', SequenceSchema);
