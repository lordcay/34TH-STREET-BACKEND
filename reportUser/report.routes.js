
//report.routes.js
const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const reportController = require('./report.controller');

// Create a general report (user, post, or comment)
router.post('/', authorize(), reportController.createReport);

// Report a specific post
router.post('/post/:postId', authorize(), reportController.reportPost);

// Report a specific comment
router.post('/post/:postId/comment/:commentId', authorize(), reportController.reportComment);

// Admin routes
router.get('/', authorize(), reportController.getAllReports);
router.get('/:id', authorize(), reportController.getReportById);
router.patch('/:id/status', authorize(), reportController.updateReportStatus);

module.exports = router;
