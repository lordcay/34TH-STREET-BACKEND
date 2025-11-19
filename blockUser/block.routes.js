// const express = require('express');
// const router = express.Router();
// const authorize = require('../_middleware/authorize');
// const blockController = require('../blockUser/block.controller');

// router.post('/', authorize(), blockController.blockUser);
// router.delete('/', authorize(), blockController.unblockUser);
// router.get('/', authorize(), blockController.getBlockedUsers);

// module.exports = router;


const express = require('express');
const router = express.Router();
const { toggleBlock } = require('./block.controller');
const { checkBlockStatus } = require('./block.controller');
const authorize = require('../_middleware/authorize');

router.post('/', authorize(), toggleBlock); // handles both block + unblock
// In block.routes.js
router.get('/status/:blockedId', authorize(), checkBlockStatus);

module.exports = router;
