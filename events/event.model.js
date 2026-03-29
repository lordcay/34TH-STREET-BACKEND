// events/event.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// RSVP sub-schema
const rsvpSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  status: { 
    type: String, 
    enum: ['going', 'interested', 'not_going'],
    default: 'going'
  },
  respondedAt: { type: Date, default: Date.now }
}, { _id: false });

const eventSchema = new Schema({
  // Creator
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'Account', 
    required: true,
    index: true
  },
  
  // Event Details
  title: { 
    type: String, 
    required: true,
    maxlength: 200,
    trim: true
  },
  
  description: { 
    type: String, 
    required: true,
    maxlength: 5000,
    trim: true
  },
  
  // Category
  category: {
    type: String,
    enum: ['social', 'professional', 'educational', 'cultural', 'sports', 'entertainment', 'networking', 'other'],
    default: 'social'
  },
  
  // Date & Time
  date: { type: Date, required: true, index: true },
  startDate: { type: Date },
  endDate: { type: Date },
  
  // Location
  venueName: { type: String, maxlength: 200 },
  fullAddress: { type: String, maxlength: 500 },
  location: { type: String, maxlength: 500 }, // Alias for fullAddress
  
  // Geolocation for distance calculations
  coordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  
  // Online event
  isOnline: { type: Boolean, default: false },
  meetingLink: { type: String },
  
  // Cover image
  image: { type: String },
  imageUrl: { type: String },
  
  // Attendees
  expectedAttendees: { type: Number, default: 50 },
  maxAttendees: { type: Number },
  attendees: [rsvpSchema],
  attendeeCount: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'published'
  },
  
  // Soft delete
  isDeleted: { type: Boolean, default: false },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for geospatial queries
eventSchema.index({ coordinates: '2dsphere' });

// Index for date-based queries
eventSchema.index({ date: 1, status: 1 });

// Virtual for slotsLeft
eventSchema.virtual('slotsLeft').get(function() {
  const max = this.maxAttendees || this.expectedAttendees || 50;
  return Math.max(0, max - this.attendeeCount);
});

module.exports = mongoose.model('Event', eventSchema);
