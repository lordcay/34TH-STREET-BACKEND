// services/service.routes.js
const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const serviceController = require('./service.controller');

// ============ ADMIN ROUTES (Auth + Admin middleware required) ============
// Define these FIRST to avoid conflicts with param routes

// Get pending services for admin approval
router.get('/admin/pending', authorize(), serviceController.getPendingServices);

// Get all services (admin)
router.get('/admin/all', authorize(), serviceController.getAllServices);

// Approve service
router.post('/:id/approve', authorize(), serviceController.approveService);

// Reject service
router.post('/:id/reject', authorize(), serviceController.rejectService);

// Suspend service
router.post('/:id/suspend', authorize(), serviceController.suspendService);

// Unsuspend service
router.post('/:id/unsuspend', authorize(), serviceController.unsuspendService);

// Admin delete service
router.delete('/:id/admin-delete', authorize(), serviceController.adminDeleteService);

// ============ USER ROUTES (Auth required) ============

// Create new service
router.post('/', authorize(), serviceController.createService);

// Get user's services (all states)
router.get('/my-services', authorize(), serviceController.getMyServices);

// Get user's specific service
router.get('/my-services/:id', authorize(), serviceController.getMyServiceById);

// Update service
router.put('/:id', authorize(), serviceController.updateService);

// Delete (soft delete) service
router.delete('/:id', authorize(), serviceController.deleteService);

// ============ REVIEW ROUTES ============

// Submit a review (auth required)
router.post('/:id/reviews', authorize(), serviceController.createReview);

// Get reviews for a service (auth required for connection data)
router.get('/:id/reviews', authorize(), serviceController.getServiceReviews);

// Get review statistics/distribution for a service (public)
router.get('/:id/review-stats', serviceController.getReviewStats);

// ============ PUBLIC ROUTES (No auth required - Define LAST) ============

// Get services by category
router.get('/category/:category', serviceController.getServicesByCategory);

// Search services
router.get('/search', serviceController.searchServices);

// Get all approved services (browse screen)
router.get('/', serviceController.getApprovedServices);

// Get single service details (must be last)
router.get('/:id', serviceController.getServiceById);

module.exports = router;

