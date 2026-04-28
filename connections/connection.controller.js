const express = require('express');
const router = express.Router();
const authorize = require('_middleware/authorize');
const Connection = require('./connection.model');
const db = require('_helpers/db');
const Account = db.Account;
const { sendExpoPush } = require('../messages/utils/push');

// =============================================
// SEND CONNECTION REQUEST
// POST /connections/request
// =============================================
router.post('/request', authorize(), async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    const requesterId = req.user.id;

    console.log('📨 Connection request from', requesterId, 'to', targetUserId);

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    if (targetUserId === String(requesterId)) {
      return res.status(400).json({ error: 'Cannot connect with yourself' });
    }

    // Check if connection or request already exists
    const existing = await Connection.findOne({
      $or: [
        { requester: requesterId, target: targetUserId },
        { requester: targetUserId, target: requesterId }
      ]
    });

    if (existing) {
      if (existing.status === 'connected') {
        return res.status(400).json({ error: 'Already connected' });
      }
      // If there's an existing pending request from ME to this user, just return success
      // (prevents duplicate notifications when re-sending)
      if (existing.status === 'pending' && String(existing.requester) === String(requesterId)) {
        return res.status(200).json({ 
          message: 'Request already pending',
          connection: { id: existing._id, status: 'pending', targetUserId }
        });
      }
      // If there's  a pending request FROM them TO me, auto-accept it
      if (existing.status === 'pending' && String(existing.target) === String(requesterId)) {
        // They already sent us a request - just accept it!
        existing.status = 'connected';
        existing.connectedAt = new Date();
        await existing.save();
        return res.status(200).json({ 
          message: 'Auto-connected (they already requested you)',
          connection: { id: existing._id, status: 'connected', targetUserId }
        });
      }
    }

    // Create new connection request
    const connection = new Connection({
      requester: requesterId,
      target: targetUserId,
      status: 'pending',
      requestedAt: new Date()
    });

    await connection.save();
    console.log('✅ Connection request saved:', connection._id);

    // Get requester's info for notification
    const requester = await Account.findById(requesterId).select('firstName lastName');
    const requesterName = `${requester?.firstName || ''} ${requester?.lastName || ''}`.trim() || 'Someone';

    // Get target user's push token
    const targetUser = await Account.findById(targetUserId).select('expoPushToken');

    // Send push notification to target user
    if (targetUser?.expoPushToken) {
      await sendExpoPush({
        to: targetUser.expoPushToken,
        title: 'New Connection Request 🤝',
        body: `${requesterName} wants to connect with you`,
        channelId: 'connections',
        data: {
          type: 'connection_request',
          requesterId: String(requesterId),
          requesterName,
          screen: 'Notifications',
        },
      }).catch(err => console.error('Connection request push failed:', err?.message));
      console.log('📤 Push notification sent to', targetUserId);
    } else {
      console.log('⚠️ No push token for user', targetUserId);
    }

    // 🔴 EMIT SOCKET EVENT for real-time update
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const targetSocketId = connectedUsers?.[targetUserId];
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('connection:request', {
        requesterId: String(requesterId),
        requesterName,
        connectionId: String(connection._id),
        timestamp: new Date().toISOString()
      });
      console.log('📡 Socket event emitted to', targetUserId);
    }

    res.status(201).json({
      message: 'Connection request sent',
      connection: {
        id: connection._id,
        status: connection.status,
        targetUserId
      }
    });

  } catch (error) {
    console.error('❌ Send connection request error:', error);
    next(error);
  }
});

// =============================================
// CANCEL CONNECTION REQUEST
// DELETE /connections/request/:targetUserId
// =============================================
router.delete('/request/:targetUserId', authorize(), async (req, res, next) => {
  try {
    const { targetUserId } = req.params;
    const requesterId = req.user.id;

    const deleted = await Connection.findOneAndDelete({
      requester: requesterId,
      target: targetUserId,
      status: 'pending'
    });

    if (!deleted) {
      return res.status(404).json({ error: 'No pending request found' });
    }

    // 🔴 EMIT SOCKET EVENT for real-time update (notify target that request was cancelled)
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const targetSocketId = connectedUsers?.[targetUserId];
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('connection:cancelled', {
        requesterId: String(requesterId),
        timestamp: new Date().toISOString()
      });
      console.log('📡 Socket event (cancelled) emitted to', targetUserId);
    }

    console.log('✅ Connection request cancelled');
    res.json({ message: 'Connection request cancelled' });

  } catch (error) {
    console.error('❌ Cancel connection request error:', error);
    next(error);
  }
});

// =============================================
// ACCEPT CONNECTION REQUEST
// POST /connections/accept/:requesterId
// =============================================
router.post('/accept/:requesterId', authorize(), async (req, res, next) => {
  try {
    const { requesterId } = req.params;
    const targetId = req.user.id;

    const connection = await Connection.findOne({
      requester: requesterId,
      target: targetId,
      status: 'pending'
    });

    if (!connection) {
      return res.status(404).json({ error: 'No pending request found' });
    }

    // Update connection status
    connection.status = 'connected';
    connection.connectedAt = new Date();
    await connection.save();

    console.log('✅ Connection accepted:', connection._id);

    // Get target's info for notification
    const target = await Account.findById(targetId).select('firstName lastName');
    const targetName = `${target?.firstName || ''} ${target?.lastName || ''}`.trim() || 'Someone';

    // Get requester's push token
    const requester = await Account.findById(requesterId).select('expoPushToken');

    // Send push notification to requester
    if (requester?.expoPushToken) {
      await sendExpoPush({
        to: requester.expoPushToken,
        title: 'Connection Accepted! 🎉',
        body: `${targetName} accepted your connection request`,
        channelId: 'connections',
        data: {
          type: 'connection_accepted',
          targetUserId: String(targetId),
          targetName,
          screen: 'Notifications',
        },
      }).catch(err => console.error('Connection accepted push failed:', err?.message));
      console.log('📤 Push notification (accepted) sent to', requesterId);
    } else {
      console.log('⚠️ No push token for user', requesterId);
    }

    // 🔴 EMIT SOCKET EVENT for real-time update to BOTH users
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    // Get requester's info for the accepter's UI update
    const requesterInfo = await Account.findById(requesterId).select('firstName lastName');
    const requesterName = `${requesterInfo?.firstName || ''} ${requesterInfo?.lastName || ''}`.trim() || 'Someone';
    
    // Emit to the REQUESTER (User A who sent the request)
    const requesterSocketId = connectedUsers?.[requesterId];
    if (requesterSocketId) {
      io.to(requesterSocketId).emit('connection:accepted', {
        accepterId: String(targetId),
        targetUserId: String(targetId), // Keep for backwards compatibility
        targetName,
        connectionId: String(connection._id),
        timestamp: new Date().toISOString()
      });
      console.log('📡 Socket event (accepted) emitted to requester', requesterId);
    }
    
    // 🔴 NEW: Also emit to the ACCEPTER (User B who accepted) so their UI updates too
    const accepterSocketId = connectedUsers?.[targetId];
    if (accepterSocketId) {
      io.to(accepterSocketId).emit('connection:accepted', {
        accepterId: String(targetId),
        targetUserId: String(requesterId), // For the accepter, the "target" is the requester
        targetName: requesterName,
        connectionId: String(connection._id),
        timestamp: new Date().toISOString()
      });
      console.log('📡 Socket event (accepted) emitted to accepter', targetId);
    }

    res.json({
      message: 'Connection accepted',
      connection: {
        id: connection._id,
        status: 'connected',
        connectedAt: connection.connectedAt
      }
    });

  } catch (error) {
    console.error('❌ Accept connection request error:', error);
    next(error);
  }
});

// =============================================
// DECLINE CONNECTION REQUEST
// POST /connections/decline/:requesterId
// =============================================
router.post('/decline/:requesterId', authorize(), async (req, res, next) => {
  try {
    const { requesterId } = req.params;
    const targetId = req.user.id;

    const deleted = await Connection.findOneAndDelete({
      requester: requesterId,
      target: targetId,
      status: 'pending'
    });

    if (!deleted) {
      return res.status(404).json({ error: 'No pending request found' });
    }

    console.log('✅ Connection request declined');
    res.json({ message: 'Connection request declined' });

  } catch (error) {
    console.error('❌ Decline connection request error:', error);
    next(error);
  }
});

// =============================================
// REMOVE CONNECTION
// DELETE /connections/:userId
// =============================================
router.delete('/:userId', authorize(), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const deleted = await Connection.findOneAndDelete({
      $or: [
        { requester: currentUserId, target: userId, status: 'connected' },
        { requester: userId, target: currentUserId, status: 'connected' }
      ]
    });

    if (!deleted) {
      return res.status(404).json({ error: 'No connection found' });
    }

    console.log('✅ Connection removed');

    // 🔴 EMIT SOCKET EVENT to BOTH users for real-time update
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    
    // Emit to the OTHER user so their UI updates instantly
    const otherUserSocketId = connectedUsers?.[userId];
    if (otherUserSocketId) {
      io.to(otherUserSocketId).emit('connection:removed', {
        userId: String(currentUserId),
        timestamp: new Date().toISOString()
      });
      console.log('📡 Socket event (removed) emitted to', userId);
    }
    
    // Also emit to current user (for consistency across devices)
    const currentUserSocketId = connectedUsers?.[currentUserId];
    if (currentUserSocketId) {
      io.to(currentUserSocketId).emit('connection:removed', {
        userId: String(userId),
        timestamp: new Date().toISOString()
      });
      console.log('📡 Socket event (removed) emitted to', currentUserId);
    }

    res.json({ message: 'Connection removed' });

  } catch (error) {
    console.error('❌ Remove connection error:', error);
    next(error);
  }
});

// =============================================
// GET PENDING REQUESTS (received)
// GET /connections/requests/pending
// =============================================
router.get('/requests/pending', authorize(), async (req, res, next) => {
  try {
    const userId = req.user.id;

    const requests = await Connection.find({
      target: userId,
      status: 'pending'
    })
    .populate('requester', 'firstName lastName email photos industry type graduationYear origin')
    .sort({ requestedAt: -1 });

    console.log(`📋 Found ${requests.length} pending requests for user ${userId}`);

    res.json({
      requests: requests.map(r => ({
        id: r._id,
        requester: r.requester,
        requestedAt: r.requestedAt,
        createdAt: r.requestedAt
      }))
    });

  } catch (error) {
    console.error('❌ Get pending requests error:', error);
    next(error);
  }
});

// =============================================
// GET SENT REQUESTS (outgoing)
// GET /connections/requests/sent
// =============================================
router.get('/requests/sent', authorize(), async (req, res, next) => {
  try {
    const userId = req.user.id;

    const requests = await Connection.find({
      requester: userId,
      status: 'pending'
    })
    .populate('target', 'firstName lastName email photos industry')
    .sort({ requestedAt: -1 });

    res.json({
      requests: requests.map(r => ({
        id: r._id,
        target: r.target,
        requestedAt: r.requestedAt
      }))
    });

  } catch (error) {
    console.error('❌ Get sent requests error:', error);
    next(error);
  }
});

// =============================================
// GET ALL CONNECTIONS
// GET /connections
// =============================================
router.get('/', authorize(), async (req, res, next) => {
  try {
    const userId = req.user.id;

    const connections = await Connection.find({
      $or: [
        { requester: userId, status: 'connected' },
        { target: userId, status: 'connected' }
      ]
    })
    .populate('requester', 'firstName lastName email photos industry type')
    .populate('target', 'firstName lastName email photos industry type')
    .sort({ connectedAt: -1 });

    // Format to return the "other" user
    const formatted = connections.map(c => {
      const isRequester = String(c.requester._id) === String(userId);
      const otherUser = isRequester ? c.target : c.requester;
      return {
        connectionId: c._id,
        user: otherUser,
        connectedAt: c.connectedAt
      };
    });

    res.json({ connections: formatted });

  } catch (error) {
    console.error('❌ Get connections error:', error);
    next(error);
  }
});

// =============================================
// GET CONNECTION STATUS WITH SPECIFIC USER
// GET /connections/status/:userId
// =============================================
router.get('/status/:userId', authorize(), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const connection = await Connection.findOne({
      $or: [
        { requester: currentUserId, target: userId },
        { requester: userId, target: currentUserId }
      ]
    });

    if (!connection) {
      return res.json({ status: 'none' });
    }

    if (connection.status === 'connected') {
      return res.json({ status: 'connected' });
    }

    // Check if current user sent the request or received it
    if (String(connection.requester) === String(currentUserId)) {
      return res.json({ status: 'pending' }); // Outgoing request
    } else {
      return res.json({ status: 'received' }); // Incoming request
    }

  } catch (error) {
    console.error('❌ Get connection status error:', error);
    next(error);
  }
});

// =============================================
// GET CONNECTION COUNT
// GET /connections/count
// =============================================
router.get('/count', authorize(), async (req, res, next) => {
  try {
    const userId = req.user.id;

    const count = await Connection.countDocuments({
      $or: [
        { requester: userId, status: 'connected' },
        { target: userId, status: 'connected' }
      ]
    });

    res.json({ count });

  } catch (error) {
    console.error('❌ Get connection count error:', error);
    next(error);
  }
});

// =============================================
// GET CONNECTION COUNT FOR SPECIFIC USER
// GET /connections/count/:userId
// =============================================
router.get('/count/:userId', authorize(), async (req, res, next) => {
  try {
    const { userId } = req.params;

    const count = await Connection.countDocuments({
      $or: [
        { requester: userId, status: 'connected' },
        { target: userId, status: 'connected' }
      ]
    });

    res.json({ count });

  } catch (error) {
    console.error('❌ Get connection count for user error:', error);
    next(error);
  }
});

module.exports = router;
