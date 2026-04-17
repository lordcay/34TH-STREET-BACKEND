// events/event.controller.js
const Event = require('./event.model');
const Connection = require('../connections/connection.model');

// Export all controller functions
module.exports = {
  getEvents,
  getUpcomingEvents,
  getPastEvents,
  getMyEvents,
  getAttendingEvents,
  searchEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  rsvpEvent,
  getAttendees,
  addComment,
  getComments,
  deleteComment
};

// ==================== Controller Functions ====================

async function getEvents(req, res, next) {
  try {
    const { status, category, limit = 20, page = 1 } = req.query;
    const query = { isDeleted: false, status: 'published' };
    
    if (category) query.category = category;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName photos')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments(query);
    
    // Enrich events with isAttending for the current user
    const enrichedEvents = events.map(e => {
      const ev = e.toJSON();
      ev.isAttending = req.user ? (ev.attendees || []).some(
        a => String(a.userId) === req.user.id && a.status === 'going'
      ) : false;
      return ev;
    });

    res.json({
      success: true,
      data: enrichedEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getUpcomingEvents(req, res, next) {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find({
      isDeleted: false,
      status: 'published',
      date: { $gte: new Date() }
    })
      .populate('createdBy', 'firstName lastName photos')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments({
      isDeleted: false,
      status: 'published',
      date: { $gte: new Date() }
    });
    
    // Enrich events with isAttending for the current user
    const enrichedEvents = events.map(e => {
      const ev = e.toJSON();
      ev.isAttending = (ev.attendees || []).some(
        a => String(a.userId) === req.user.id && a.status === 'going'
      );
      return ev;
    });

    res.json({
      success: true,
      data: enrichedEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getPastEvents(req, res, next) {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find({
      isDeleted: false,
      status: { $in: ['published', 'completed'] },
      date: { $lt: new Date() }
    })
      .populate('createdBy', 'firstName lastName photos')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments({
      isDeleted: false,
      status: { $in: ['published', 'completed'] },
      date: { $lt: new Date() }
    });
    
    const enrichedEvents = events.map(e => {
      const ev = e.toJSON();
      ev.isAttending = (ev.attendees || []).some(
        a => String(a.userId) === req.user.id && a.status === 'going'
      );
      return ev;
    });

    res.json({
      success: true,
      data: enrichedEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + events.length < total
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyEvents(req, res, next) {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find({
      createdBy: req.user.id,
      isDeleted: false
    })
      .populate('createdBy', 'firstName lastName photos')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments({
      createdBy: req.user.id,
      isDeleted: false
    });
    
    // Enrich events with isAttending for the current user
    const enrichedEvents = events.map(e => {
      const ev = e.toJSON();
      ev.isAttending = (ev.attendees || []).some(
        a => String(a.userId) === req.user.id && a.status === 'going'
      );
      return ev;
    });

    res.json({
      success: true,
      data: enrichedEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAttendingEvents(req, res, next) {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find({
      isDeleted: false,
      status: 'published',
      'attendees.userId': req.user.id,
      'attendees.status': 'going'
    })
      .populate('createdBy', 'firstName lastName photos')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments({
      isDeleted: false,
      status: 'published',
      'attendees.userId': req.user.id,
      'attendees.status': 'going'
    });
    
    // These events are already filtered to attending, but set the flag explicitly
    const enrichedEvents = events.map(e => {
      const ev = e.toJSON();
      ev.isAttending = true;
      return ev;
    });

    res.json({
      success: true,
      data: enrichedEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function searchEvents(req, res, next) {
  try {
    const { q, category, startDate, endDate, limit = 20 } = req.query;
    const query = { isDeleted: false, status: 'published' };
    
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { venueName: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName photos')
      .sort({ date: 1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    next(error);
  }
}

async function getEventById(req, res, next) {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      isDeleted: false
    })
      .populate('createdBy', 'firstName lastName photos email')
      .populate('attendees.userId', 'firstName lastName photos email');
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    // Check if user is attending
    const attendeesArray = event.attendees || [];
    const isAttending = attendeesArray.some(
      a => a.userId && a.userId._id && a.userId._id.toString() === req.user.id && a.status === 'going'
    );

    const currentUserId = req.user.id;
    const isOrganizer = event.createdBy._id.toString() === currentUserId;

    // Filter attendees by visibility (organizer sees all)
    let visibleAttendees = attendeesArray.filter(a => a.status === 'going');
    if (!isOrganizer) {
      const userConnections = await Connection.find({
        $or: [
          { requester: currentUserId, status: 'connected' },
          { target: currentUserId, status: 'connected' }
        ]
      }).lean();
      const connectedIds = new Set(userConnections.map(c =>
        String(c.requester) === String(currentUserId) ? String(c.target) : String(c.requester)
      ));

      visibleAttendees = visibleAttendees.filter(a => {
        const attendeeId = String(a.userId?._id || a.userId);
        if (attendeeId === String(currentUserId)) return true;
        const vis = a.visibility || 'everyone';
        if (vis === 'everyone') return true;
        if (vis === 'connections') return connectedIds.has(attendeeId);
        return false;
      });
    }
    
    // Format attendees for response — enrich with connection data
    const formattedAttendees = await Promise.all(
      visibleAttendees.map(async (a) => {
          const attendeeId = a.userId?._id;
          let connectionStatus = 'none';
          let connectionCount = 0;

          if (attendeeId) {
            const [connStatus, count] = await Promise.all([
              String(attendeeId) !== String(currentUserId)
                ? Connection.getStatus(currentUserId, attendeeId)
                : Promise.resolve('self'),
              Connection.countDocuments({
                $or: [
                  { requester: attendeeId, status: 'connected' },
                  { target: attendeeId, status: 'connected' },
                ],
              }),
            ]);
            connectionStatus = connStatus;
            connectionCount = count;
          }

          return {
            user: a.userId,
            status: a.status,
            visibility: a.visibility || 'everyone',
            respondedAt: a.respondedAt,
            connectionStatus,
            connectionCount,
          };
        })
    );
    
    res.json({
      success: true,
      data: {
        ...event.toJSON(),
        attendees: formattedAttendees,
        attendeeCount: event.attendeeCount,
        isAttending,
        isOrganizer
      }
    });
  } catch (error) {
    next(error);
  }
}

async function createEvent(req, res, next) {
  try {
    const {
      title,
      description,
      category,
      date,
      startDate,
      endDate,
      venueName,
      fullAddress,
      location,
      coordinates,
      isOnline,
      meetingLink,
      photos,
      image,
      imageUrl,
      expectedAttendees,
      maxAttendees
    } = req.body;
    
    // Validate required fields
    if (!title || !description || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, description, and date are required' 
      });
    }

    // Sanitize photos array (max 3 Cloudinary URLs)
    let sanitizedPhotos = [];
    if (Array.isArray(photos)) {
      sanitizedPhotos = photos.filter(p => typeof p === 'string' && p.startsWith('https://')).slice(0, 3);
    }
    
    const event = new Event({
      createdBy: req.user.id,
      title,
      description,
      category,
      date: new Date(date),
      startDate: startDate ? new Date(startDate) : new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      venueName,
      fullAddress: fullAddress || location,
      location: location || fullAddress,
      coordinates: coordinates || { type: 'Point', coordinates: [0, 0] },
      isOnline,
      meetingLink,
      photos: sanitizedPhotos,
      image: image || sanitizedPhotos[0] || null,
      imageUrl: imageUrl || image || sanitizedPhotos[0] || null,
      expectedAttendees: expectedAttendees || 50,
      maxAttendees,
      attendees: [],
      attendeeCount: 0
    });
    
    await event.save();
    
    await event.populate('createdBy', 'firstName lastName photos');
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    next(error);
  }
}

async function updateEvent(req, res, next) {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      isDeleted: false
    });
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    // Only organizer can update
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this event' });
    }
    
    const allowedUpdates = [
      'title', 'description', 'category', 'date', 'startDate', 'endDate',
      'venueName', 'fullAddress', 'location', 'coordinates', 'isOnline',
      'meetingLink', 'photos', 'image', 'imageUrl', 'expectedAttendees', 'maxAttendees', 'status'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'date' || field === 'startDate' || field === 'endDate') {
          event[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else if (field === 'photos') {
          // Sanitize photos array (max 3 Cloudinary URLs)
          const photos = req.body[field];
          if (Array.isArray(photos)) {
            event.photos = photos.filter(p => typeof p === 'string' && p.startsWith('https://')).slice(0, 3);
            // Sync legacy fields
            event.image = event.photos[0] || null;
            event.imageUrl = event.photos[0] || null;
          }
        } else {
          event[field] = req.body[field];
        }
      }
    });
    
    await event.save();
    await event.populate('createdBy', 'firstName lastName photos');
    
    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    next(error);
  }
}

async function deleteEvent(req, res, next) {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      isDeleted: false
    });
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    // Only organizer can delete
    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
    }
    
    event.isDeleted = true;
    await event.save();
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function rsvpEvent(req, res, next) {
  try {
    const { status = 'going', visibility = 'everyone' } = req.body;
    
    if (!['going', 'interested', 'not_going'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid RSVP status' });
    }

    if (!['everyone', 'connections', 'private'].includes(visibility)) {
      return res.status(400).json({ success: false, message: 'Invalid visibility option' });
    }
    
    const event = await Event.findOne({
      _id: req.params.id,
      isDeleted: false,
      status: 'published'
    });
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    // Check capacity
    const maxCapacity = event.maxAttendees || event.expectedAttendees || 999999;
    if (status === 'going' && event.attendeeCount >= maxCapacity) {
      return res.status(400).json({ success: false, message: 'Event is full' });
    }
    
    // Find existing RSVP
    const existingIndex = event.attendees.findIndex(
      a => a.userId.toString() === req.user.id
    );
    
    const wasGoing = existingIndex >= 0 && event.attendees[existingIndex].status === 'going';
    const willBeGoing = status === 'going';
    
    if (existingIndex >= 0) {
      if (status === 'not_going') {
        // Remove RSVP
        event.attendees.splice(existingIndex, 1);
      } else {
        // Update RSVP
        event.attendees[existingIndex].status = status;
        event.attendees[existingIndex].visibility = visibility;
        event.attendees[existingIndex].respondedAt = new Date();
      }
    } else if (status !== 'not_going') {
      // Add new RSVP
      event.attendees.push({
        userId: req.user.id,
        status,
        visibility,
        respondedAt: new Date()
      });
    }
    
    // Update attendee count
    if (wasGoing && !willBeGoing) {
      event.attendeeCount = Math.max(0, event.attendeeCount - 1);
    } else if (!wasGoing && willBeGoing) {
      event.attendeeCount += 1;
    }
    
    await event.save();
    
    res.json({
      success: true,
      message: status === 'going' ? 'You are now attending this event' : 
               status === 'interested' ? 'You are interested in this event' :
               'RSVP removed',
      data: {
        status,
        attendeeCount: event.attendeeCount,
        isAttending: status === 'going'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAttendees(req, res, next) {
  try {
    const { status = 'going', limit = 50 } = req.query;
    
    const event = await Event.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate('attendees.userId', 'firstName lastName photos');
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    let attendees = event.attendees;
    if (status) {
      attendees = attendees.filter(a => a.status === status);
    }
    
    const currentUserId = req.user?.id;
    const isOrganizer = String(event.createdBy) === String(currentUserId) ||
                        String(event.createdBy?._id) === String(currentUserId);

    // Visibility filtering: organizer sees everyone
    // Other users see based on each attendee's visibility preference
    if (!isOrganizer && currentUserId) {
      // Get current user's connections for filtering
      const userConnections = await Connection.find({
        $or: [
          { requester: currentUserId, status: 'connected' },
          { target: currentUserId, status: 'connected' }
        ]
      }).lean();
      
      const connectedIds = new Set(userConnections.map(c => 
        String(c.requester) === String(currentUserId) 
          ? String(c.target) 
          : String(c.requester)
      ));

      attendees = attendees.filter(a => {
        const attendeeId = String(a.userId?._id || a.userId);
        // Always show user themselves
        if (attendeeId === String(currentUserId)) return true;
        
        const vis = a.visibility || 'everyone';
        if (vis === 'everyone') return true;
        if (vis === 'connections') return connectedIds.has(attendeeId);
        // vis === 'private' → hidden from non-organizers
        return false;
      });
    }
    
    const totalVisible = attendees.length;
    attendees = attendees.slice(0, parseInt(limit));
    
    // Enrich attendees with connection data
    const enrichedAttendees = await Promise.all(
      attendees.map(async (a) => {
        const attendeeId = a.userId?._id;
        let connectionStatus = 'none';
        let connectionCount = 0;

        if (attendeeId && currentUserId) {
          const [connStatus, count] = await Promise.all([
            String(attendeeId) !== String(currentUserId)
              ? Connection.getStatus(currentUserId, attendeeId)
              : Promise.resolve('self'),
            Connection.countDocuments({
              $or: [
                { requester: attendeeId, status: 'connected' },
                { target: attendeeId, status: 'connected' },
              ],
            }),
          ]);
          connectionStatus = connStatus;
          connectionCount = count;
        }

        return {
          user: a.userId,
          status: a.status,
          visibility: a.visibility || 'everyone',
          respondedAt: a.respondedAt,
          connectionStatus,
          connectionCount,
        };
      })
    );
    
    res.json({
      success: true,
      data: enrichedAttendees,
      total: totalVisible
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Comment Functions ====================

async function addComment(req, res, next) {
  try {
    const { text, rating } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Comment must be 1000 characters or fewer' });
    }

    if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }

    const event = await Event.findOne({ _id: req.params.id, isDeleted: false });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Only attendees (status: 'going') or the organizer can comment
    const isOrganizer = String(event.createdBy) === userId;
    const isAttendee = event.attendees.some(
      a => String(a.userId) === userId && a.status === 'going'
    );

    if (!isAttendee && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Only attendees or the organizer can comment on this event'
      });
    }

    const comment = {
      userId,
      text: text.trim(),
      rating: rating || undefined,
      createdAt: new Date()
    };

    event.comments.push(comment);
    event.commentCount = event.comments.length;
    await event.save();

    // Return the saved comment with populated user
    const savedComment = event.comments[event.comments.length - 1];
    await event.populate('comments.userId', 'firstName lastName photos');
    const populated = event.comments.id(savedComment._id);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        _id: populated._id,
        user: populated.userId,
        text: populated.text,
        rating: populated.rating,
        createdAt: populated.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getComments(req, res, next) {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const event = await Event.findOne({ _id: req.params.id, isDeleted: false })
      .populate('comments.userId', 'firstName lastName photos');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Sort comments newest first
    const allComments = (event.comments || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const total = allComments.length;
    const paged = allComments.slice(skip, skip + parseInt(limit));

    const comments = paged.map(c => ({
      _id: c._id,
      user: c.userId,
      text: c.text,
      rating: c.rating,
      createdAt: c.createdAt
    }));

    // Compute average rating
    const rated = allComments.filter(c => c.rating);
    const averageRating = rated.length > 0
      ? +(rated.reduce((sum, c) => sum + c.rating, 0) / rated.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: comments,
      averageRating,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + paged.length < total
      }
    });
  } catch (error) {
    next(error);
  }
}

async function deleteComment(req, res, next) {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;

    const event = await Event.findOne({ _id: id, isDeleted: false });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const comment = event.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Only the commenter or the organizer can delete
    const isCommentOwner = String(comment.userId) === userId;
    const isOrganizer = String(event.createdBy) === userId;

    if (!isCommentOwner && !isOrganizer) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    event.comments.pull(commentId);
    event.commentCount = event.comments.length;
    await event.save();

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
}
