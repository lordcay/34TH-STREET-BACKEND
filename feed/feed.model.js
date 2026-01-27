const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    dayKey: { type: String, required: true, unique: true }, // "YYYY-MM-DD" (server local day)
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, trim: true, maxlength: 2000 },
    imageUrl: { type: String, trim: true },
    expiresAt: { type: Date, required: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },

    agreeCount: { type: Number, default: 0 },
    disagreeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Feed', schema);
