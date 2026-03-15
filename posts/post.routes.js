// posts/post.routes.js
const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const postController = require('./post.controller');

// ============ Public/Semi-Public Routes ============

// Get feed posts (requires auth)
router.get('/feed', authorize(), postController.getFeed);

// Get trending hashtags
router.get('/trending/hashtags', authorize(), postController.getTrendingHashtags);

// Search posts by hashtag
router.get('/search/hashtag/:hashtag', authorize(), postController.searchByHashtag);

// Get posts by user
router.get('/user/:userId', authorize(), postController.getUserPosts);

// Get a single post
router.get('/:postId', authorize(), postController.getPost);

// ============ Protected Routes ============

// Create a new post
router.post('/', authorize(), postController.createPost);

// Update a post
router.put('/:postId', authorize(), postController.updatePost);

// Delete a post
router.delete('/:postId', authorize(), postController.deletePost);

// ============ Reactions ============

// React to a post
router.post('/:postId/react', authorize(), postController.reactToPost);

// Remove reaction
router.delete('/:postId/react', authorize(), postController.removeReaction);

// ============ Comments ============

// Add comment
router.post('/:postId/comments', authorize(), postController.addComment);

// Delete comment
router.delete('/:postId/comments/:commentId', authorize(), postController.deleteComment);

// Like comment
router.post('/:postId/comments/:commentId/like', authorize(), postController.likeComment);

// ============ Sharing ============

// Share/repost a post
router.post('/:postId/share', authorize(), postController.sharePost);

// ============ Polls ============

// Vote on poll
router.post('/:postId/poll/vote', authorize(), postController.votePoll);

module.exports = router;
