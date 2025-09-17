// const express = require('express');
// const router = express.Router();
// const authorize = require('_middleware/authorize');
// const controller = require('./message.controller');

// router.post('/', authorize(), controller.sendMessage);
// router.get('/:userId', authorize(), controller.getMessages);
// router.get('/conversations/list', authorize(), controller.getConversations);


// module.exports = router;


const express = require('express');
const router = express.Router();
const authorize = require('_middleware/authorize');
const controller = require('./message.controller');

// ✅ Put static route BEFORE the param route
router.get('/conversations/list', authorize(), controller.getConversations);
router.get('/:userId', authorize(), controller.getMessages);
router.post('/', authorize(), controller.sendMessage);

module.exports = router;
