// events/event.controller.js
const Event = require('./event.model');

// Export all controller functions
module.exports = {
  getEvents,
  getUpcomingEvents,
  getMyEvents,
  getAttendingEvents,
  searchEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  rsvpEvent,
  getAttendees
};

// ==================== Controller Functions ====================

async function getEvents(req, res, next) {
  try {
    const { status, category, limit = 20, page = 1 } = req.query;
    const query = { isDeleted: false, status: 'published' };
    
    if (category) query.category = category;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName profilePicture')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments(query);
    
    res.json({
      success: true,
      data: events,
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
      .populate('createdBy', 'firstName lastName profilePicture')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments({
      isDeleted: false,
      status: 'published',
      date: { $gte: new Date() }
    });
    
    res.json({
      success: true,
      data: events,
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

async function getMyEvents(req, res, next) {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find({
      createdBy: req.user.id,
      isDeleted: false
    })
      .populate('createdBy', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments({
      createdBy: req.user.id,
      isDeleted: false
    });
    
    res.json({
      success: true,
      data: events,
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
      .populate('createdBy', 'firstName lastName profilePicture')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Event.countDocuments({
      isDeleted: false,
      status: 'published',
      'attendees.userId': req.user.id,
      'attendees.status': 'going'
    });
    
    res.json({
      success: true,
      data: events,
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
      .populate('createdBy', 'firstName lastName profilePicture')
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
      .populate('createdBy', 'firstName lastName profilePicture email')
      .populate('attendees.userId', 'firstName lastName profilePicture email');
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    // Check if user is attending
    const attendeesArray = event.attendees || [];
    const isAttending = attendeesArray.some(
      a => a.userId && a.userId._id && a.userId._id.toString() === req.user.id && a.status === 'going'
    );
    
    // Format attendees for response
    const formattedAttendees = attendeesArray
      .filter(a => a.status === 'going')
      .map(a => ({
        user: a.userId,
        status: a.status,
        respondedAt: a.respondedAt
      }));
    
    res.json({
      success: true,
      data: {
        ...event.toJSON(),
        attendees: formattedAttendees,
        isAttending,
        isOrganizer: event.createdBy._id.toString() === req.user.id
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
      image,
      imageUrl: imageUrl || image,
      expectedAttendees: expectedAttendees || 50,
      maxAttendees,
      attendees: [{ userId: req.user.id, status: 'going' }],
      attendeeCount: 1
    });
    
    await event.save();
    
    await event.populate('createdBy', 'firstName lastName profilePicture');
    
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
      'meetingLink', 'image', 'imageUrl', 'expectedAttendees', 'maxAttendees', 'status'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'date' || field === 'startDate' || field === 'endDate') {
          event[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          event[field] = req.body[field];
        }
      }
    });
    
    await event.save();
    await event.populate('createdBy', 'firstName lastName profilePicture');
    
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
    const { status = 'going' } = req.body;
    
    if (!['going', 'interested', 'not_going'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid RSVP status' });
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
        event.attendees[existingIndex].respondedAt = new Date();
      }
    } else if (status !== 'not_going') {
      // Add new RSVP
      event.attendees.push({
        userId: req.user.id,
        status,
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
        attendeeCount: event.attendeeCount
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
    }).populate('attendees.userId', 'firstName lastName profilePicture');
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    let attendees = event.attendees;
    if (status) {
      attendees = attendees.filter(a => a.status === status);
    }
    
    attendees = attendees.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: attendees.map(a => ({
        user: a.userId,
        status: a.status,
        respondedAt: a.respondedAt
      })),
      total: event.attendees.filter(a => a.status === status).length
    });
  } catch (error) {
    next(error);
  }
}
