// // routes/chatroomMessage.routes.js
// const express = require('express');
// const router = express.Router();
// const chatroomMessageController = require('../chatroomMessages/chatroomMessage.controller');
// const authorize = require('_middleware/authorize');

// // Fetch messages for a chatroom
// router.get('/:chatroomId/messages', authorize(), chatroomMessageController.fetchMessages);

// // Send a message to a chatroom
// router.post('/', authorize(), chatroomMessageController.sendMessage);

// module.exports = router;


// routes/chatroomMessage.routes.js
const express = require('express');
const router = express.Router();
const chatroomMessageController = require('../chatroomMessages/chatroomMessage.controller');
const authorize = require('_middleware/authorize');

// Fetch messages for a chatroom
router.get('/:chatroomId/messages', authorize(), chatroomMessageController.fetchMessages);

// Send a message to a chatroom
router.post('/', authorize(), chatroomMessageController.sendMessage);

// Delete a message (only by sender)
router.delete('/:messageId', authorize(), chatroomMessageController.deleteMessage);

// Like/Unlike a message
router.post('/:messageId/like', authorize(), chatroomMessageController.toggleLike);

// Add a nested reply to a message
router.post('/:messageId/reply', authorize(), chatroomMessageController.addReply);

// Get replies for a message (paginated)
router.get('/:messageId/replies', authorize(), chatroomMessageController.getReplies);

// Like/Unlike a nested reply
router.post('/:messageId/replies/:replyId/like', authorize(), chatroomMessageController.toggleReplyLike);

module.exports = router;
