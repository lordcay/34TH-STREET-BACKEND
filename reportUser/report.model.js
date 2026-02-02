const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportSchema = new Schema({
  reporter: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  reportedUser: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  reason: { type: String, required: true, maxlength: 1000 },

    status: {
    type: String,
    enum: ['NEW', 'IN_REVIEW', 'RESOLVED'],
    default: 'NEW',
  },
  resolvedAt: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
