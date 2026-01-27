const express = require('express');
const router = express.Router();

const authorize = require('../_middleware/authorize');
const Role = require('../_helpers/role');

const controller = require('./feed.controller');

// Everyone logged-in can see today's gist
router.get('/today', authorize(), controller.getToday);

// Admin only: create/update today's gist
router.post('/', authorize(Role.Admin), controller.createToday);

// Votes
router.post('/:postId/vote', authorize(), controller.vote);

// Comments
router.get('/:postId/comments', authorize(), controller.getComments);
router.post('/:postId/comments', authorize(), controller.addComment);

module.exports = router;
