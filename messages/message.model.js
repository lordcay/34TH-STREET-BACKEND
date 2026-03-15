// // messages/message.model.js
// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const schema = new Schema({
//   senderId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
//   recipientId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
//   message: { type: String, required: true },
//   timestamp: { type: Date, default: Date.now },
//   read: { type: Boolean, default: false },  // ✅ New field to track read status
//   expoPushToken: { type: String }


// });

// schema.index({ senderId: 1, recipientId: 1, timestamp: 1 });
// schema.index({ recipientId: 1, read: 1, timestamp: 1 });



// module.exports = mongoose.model('Message', schema);


// messages/message.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Reaction sub-schema
const reactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  emoji: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const schema = new Schema({
  senderId:     { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  recipientId:  { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  message:      { type: String, default: '' },  // Text content (optional for media messages)
  timestamp:    { type: Date, default: Date.now },
  read:         { type: Boolean, default: false },
  expoPushToken:{ type: String },
  
  // Message type: text, image, audio, document, contact, gif
  messageType:  { 
    type: String, 
    enum: ['text', 'image', 'audio', 'document', 'contact', 'gif'],
    default: 'text' 
  },
  
  // Media fields (for image, audio, document)
  mediaUrl:     { type: String, default: null },  // URL to the uploaded file
  fileName:     { type: String, default: null },  // Original filename
  fileSize:     { type: Number, default: null },  // File size in bytes
  mimeType:     { type: String, default: null },  // MIME type
  duration:     { type: Number, default: null },  // For audio: duration in seconds
  thumbnail:    { type: String, default: null },  // Thumbnail URL for images/videos
  
  // Contact fields (for contact sharing)
  contactInfo: {
    name:       { type: String, default: null },
    phone:      { type: String, default: null },
    email:      { type: String, default: null }
  },
  
  // Reply feature - reference to the message being replied to
  replyTo: { 
    type: Schema.Types.ObjectId, 
    ref: 'Message',
    default: null 
  },
  
  // Emoji reactions
  reactions: [reactionSchema],

  // Delete feature (WhatsApp-style)
  deletedForEveryone: { type: Boolean, default: false },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null }, // Who deleted it for everyone
  deletedForUsers: [{ type: Schema.Types.ObjectId, ref: 'Account' }] // Users who deleted it for themselves
});

// Make outputs friendly for clients that may read `id` or `_id`
schema.set('toObject', { virtuals: true });
schema.set('toJSON', { virtuals: true });

// Primary query paths
schema.index({ senderId: 1, recipientId: 1, timestamp: 1 });
schema.index({ recipientId: 1, read: 1, timestamp: 1 });

// Optional: if list performance needs it later
// schema.index({ recipientId: 1, senderId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', schema);
