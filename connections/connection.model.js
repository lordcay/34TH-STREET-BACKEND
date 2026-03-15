const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const connectionSchema = new Schema({
  // User who sent the connection request
  requester: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  
  // User who received the connection request
  target: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  
  // Connection status: 'pending' or 'connected'
  status: {
    type: String,
    enum: ['pending', 'connected'],
    default: 'pending',
    index: true
  },
  
  // When the request was sent
  requestedAt: {
    type: Date,
    default: Date.now
  },
  
  // When the connection was accepted (null if pending)
  connectedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups - ensure unique connection between two users
connectionSchema.index({ requester: 1, target: 1 }, { unique: true });
connectionSchema.index({ requester: 1, status: 1 });
connectionSchema.index({ target: 1, status: 1 });

// Static method to check if two users are connected
connectionSchema.statics.areConnected = async function(userId1, userId2) {
  const connection = await this.findOne({
    $or: [
      { requester: userId1, target: userId2, status: 'connected' },
      { requester: userId2, target: userId1, status: 'connected' }
    ]
  });
  return !!connection;
};

// Static method to get connection status between two users
connectionSchema.statics.getStatus = async function(currentUserId, otherUserId) {
  const connection = await this.findOne({
    $or: [
      { requester: currentUserId, target: otherUserId },
      { requester: otherUserId, target: currentUserId }
    ]
  });
  
  if (!connection) return 'none';
  if (connection.status === 'connected') return 'connected';
  
  // Check direction for pending
  if (String(connection.requester) === String(currentUserId)) {
    return 'pending'; // Current user sent the request
  }
  return 'received'; // Current user received the request
};

module.exports = mongoose.model('Connection', connectionSchema);
