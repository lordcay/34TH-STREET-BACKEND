const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const blockSchema = new Schema({
  blocker: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  blocked: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Block', blockSchema);
