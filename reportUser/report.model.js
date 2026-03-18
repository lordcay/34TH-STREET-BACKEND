const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportSchema = new Schema({
  reporter: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  
  // What is being reported (one of these should be set)
  reportedUser: { type: Schema.Types.ObjectId, ref: 'Account' },
  reportedPost: { type: Schema.Types.ObjectId, ref: 'Post' },
  reportedComment: {
    postId: { type: Schema.Types.ObjectId, ref: 'Post' },
    commentId: { type: Schema.Types.ObjectId }
  },
  reportedChatroomMessage: {
    messageId: { type: Schema.Types.ObjectId },
    chatroomId: { type: Schema.Types.ObjectId, ref: 'Chatroom' },
    messageContent: { type: String, maxlength: 500 }
  },
  
  // Report type
  reportType: {
    type: String,
    enum: ['user', 'post', 'comment', 'chatroom_message'],
    required: true,
    default: 'user'
  },
  
  // Reason category
  reasonCategory: {
    type: String,
    enum: [
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'nudity',
      'false_information',
      'scam',
      'self_harm',
      'intellectual_property',
      'other'
    ],
    default: 'other'
  },
  
  reason: { type: String, required: false, maxlength: 1000 },

  status: {
    type: String,
    enum: ['NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'],
    default: 'NEW',
  },
  resolvedAt: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now }
});

// Index for faster queries
reportSchema.index({ reportedPost: 1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ status: 1 });

module.exports = mongoose.model('Report', reportSchema);
