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

module.exports = router;
