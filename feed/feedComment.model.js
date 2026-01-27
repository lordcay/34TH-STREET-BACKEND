const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Feed', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    text: { type: String, required: true, trim: true, maxlength: 800 },
  },
  { timestamps: true }
);

schema.index({ post: 1, createdAt: -1 });

module.exports = mongoose.model('FeedComment', schema);
