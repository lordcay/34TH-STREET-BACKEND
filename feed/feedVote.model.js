const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Feed', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    type: { type: String, enum: ['agree', 'disagree'], required: true },
  },
  { timestamps: true }
);

// One vote per user per post
schema.index({ post: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('FeedVote', schema);
