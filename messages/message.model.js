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

module.exports = mongoose.model('Message', schema);
