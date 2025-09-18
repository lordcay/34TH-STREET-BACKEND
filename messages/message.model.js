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

const schema = new Schema({
  senderId:     { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  recipientId:  { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  message:      { type: String, required: true },
  timestamp:    { type: Date, default: Date.now },
  read:         { type: Boolean, default: false },
  expoPushToken:{ type: String }
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
