// notifications/notification.controller.js
const express = require('express');
const router = express.Router();
const Notification = require('./notification.model');
const authorize = require('../_middleware/authorize');

// Get all notifications for current user
router.get('/', authorize(), async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const query = { 
      recipient: userId,
      isDeleted: false
    };
    
    if (unreadOnly === 'true') {
      query.read = false;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'firstName lastName photos profileImage verified')
      .populate('post', 'content images author')
      .lean();
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      recipient: userId, 
      read: false,
      isDeleted: false 
    });
    
    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    next(error);
  }
});

// Get unread count
router.get('/unread-count', authorize(), async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    const unreadCount = await Notification.countDocuments({ 
      recipient: userId, 
      read: false,
      isDeleted: false 
    });
    
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.put('/:id/read', authorize(), async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.put('/read-all', authorize(), async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true }
    );
    
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Delete a notification
router.delete('/:id', authorize(), async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { isDeleted: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

// Helper function to create notification (exported for use in other controllers)
async function createNotification({ recipient, sender, type, post, comment, chatroomMessage, chatroom, chatroomName, message }) {
  // Don't create notification if sender is same as recipient
  if (String(recipient) === String(sender)) {
    return null;
  }
  
  try {
    const notification = new Notification({
      recipient,
      sender,
      type,
      post,
      comment,
      chatroomMessage,
      chatroom,
      chatroomName,
      message
    });
    
    await notification.save();
    
    // Populate sender info for socket emission
    await notification.populate('sender', 'firstName lastName photos profileImage verified');
    if (post) {
      await notification.populate('post', 'content images author');
    }
    if (chatroomMessage) {
      await notification.populate('chatroomMessage', 'message chatroomId');
    }
    
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
