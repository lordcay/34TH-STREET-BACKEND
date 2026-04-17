// events/event.routes.js
const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const eventController = require('./event.controller');

// ============ List Routes ============

// Get all events (with filters)
router.get('/', authorize(), eventController.getEvents);

// Get upcoming events
router.get('/upcoming', authorize(), eventController.getUpcomingEvents);

// Get past events (for reviews/trustworthiness)
router.get('/past', authorize(), eventController.getPastEvents);

// Get user's events (created by them)
router.get('/my-events', authorize(), eventController.getMyEvents);

// Get events user is attending
router.get('/attending', authorize(), eventController.getAttendingEvents);

// Search events
router.get('/search', authorize(), eventController.searchEvents);

// ============ Single Event Routes ============

// Get single event by ID
router.get('/:id', authorize(), eventController.getEventById);

// Create event
router.post('/', authorize(), eventController.createEvent);

// Update event
router.put('/:id', authorize(), eventController.updateEvent);

// Delete event
router.delete('/:id', authorize(), eventController.deleteEvent);

// ============ RSVP Routes ============

// RSVP to event
router.post('/:id/rsvp', authorize(), eventController.rsvpEvent);

// Get event attendees
router.get('/:id/attendees', authorize(), eventController.getAttendees);

// ============ Comment Routes ============

// Add a comment to an event (attendees/organizer only)
router.post('/:id/comments', authorize(), eventController.addComment);

// Get comments for an event
router.get('/:id/comments', authorize(), eventController.getComments);

// Delete a comment
router.delete('/:id/comments/:commentId', authorize(), eventController.deleteComment);

module.exports = router;
