// messages/message.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  recipientId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },  // ✅ New field to track read status
  expoPushToken: { type: String }


});

schema.index({ senderId: 1, recipientId: 1, timestamp: 1 });
schema.index({ recipientId: 1, read: 1, timestamp: 1 });


module.exports = mongoose.model('Message', schema);
