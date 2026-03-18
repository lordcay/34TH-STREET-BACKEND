// notifications/notification.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
  // Who receives the notification
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  
  // Who triggered the notification
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  
  // Notification type
  type: {
    type: String,
    enum: [
      'mention_post',       // Someone mentioned you in a post
      'mention_comment',    // Someone mentioned you in a comment
      'mention_reply',      // Someone mentioned you in a reply
      'comment',            // Someone commented on your post
      'like_post',          // Someone liked your post
      'like_comment',       // Someone liked your comment
      'like_reply',         // Someone liked your reply
      'reply_comment',      // Someone replied to your comment
      'reply_thread',       // Someone replied in a thread you're part of
      'connection_request', // Connection request
      'connection_accepted', // Connection accepted
      'share',              // Someone shared your post
      'follow',             // Someone followed you
      // Chatroom notification types
      'chatroom_mention',   // Someone mentioned you in a chatroom
      'chatroom_like',      // Someone liked your chatroom message
      'chatroom_reply',     // Someone replied to your chatroom message
    ],
    required: true
  },
  
  // Related content
  post: {
    type: Schema.Types.ObjectId,
    ref: 'Post'
  },
  
  comment: {
    type: Schema.Types.ObjectId // Comment ID within post
  },
  
  // For chatroom-related notifications
  chatroomMessage: {
    type: Schema.Types.ObjectId,
    ref: 'ChatroomMessage'
  },
  
  chatroom: {
    type: Schema.Types.ObjectId,
    ref: 'Chatroom'
  },
  
  chatroomName: {
    type: String
  },
  
  // For tracking reply index
  replyIndex: {
    type: Number
  },
  
  // Notification message (pre-formatted)
  message: {
    type: String,
    required: true
  },
  
  // Read status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // Auto-expire after 30 days
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    index: { expires: 0 } // TTL index - MongoDB will auto-delete when expiresAt is reached
  }
  
}, { timestamps: true });

// Indexes for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
