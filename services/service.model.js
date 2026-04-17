// services/service.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const serviceSchema = new Schema({
  // Service Details
  title: {
    type: String,
    required: [true, 'Service title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
    trim: true,
    index: true,
  },

  description: {
    type: String,
    required: [true, 'Service description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
    trim: true,
  },

  // Category & Expertise
  category: {
    type: String,
    enum: ['consulting', 'tutoring', 'design', 'tech', 'fitness', 'creative', 'business', 'trade', 'event'],
    required: [true, 'Category is required'],
    index: true,
  },

  subcategory: {
    type: String,
    maxlength: 100,
    trim: true,
  },

  experience: {
    type: String,
    default: '',
    trim: true,
  },

  skills: [{
    type: String,
    trim: true,
  }],

  // Pricing (flexible text, e.g. "$50/hour", "$200-500/project")
  pricing: {
    type: String,
    maxlength: [200, 'Pricing cannot exceed 200 characters'],
    trim: true,
  },

  // Legacy pricing fields (kept for backward compatibility)
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative'],
  },

  basePrice: {
    type: Number,
    min: [0, 'Base price cannot be negative'],
  },

  // Location
  serviceLocation: {
    type: String,
    required: [true, 'Service location is required'],
    maxlength: [200, 'Service location cannot exceed 200 characters'],
    trim: true,
  },

  fullAddress: {
    type: String,
    required: [true, 'Full address is required'],
    maxlength: [500, 'Full address cannot exceed 500 characters'],
    trim: true,
  },

  // GeoJSON coordinates for distance calculation
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },

  city: {
    type: String,
    trim: true,
    index: true,
  },

  state: {
    type: String,
    trim: true,
    index: true,
  },

  // Contact Information
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required'],
    trim: true,
    lowercase: true,
  },

  contactPhone: {
    type: String,
    trim: true,
  },

  // Online Presence
  website: {
    type: String,
    trim: true,
  },

  instagram: {
    type: String,
    trim: true,
  },

  facebook: {
    type: String,
    trim: true,
  },

  twitter: {
    type: String,
    trim: true,
  },

  linkedin: {
    type: String,
    trim: true,
  },

  // Provider Information
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'Provider is required'],
    index: true,
  },

  // Status & Approval
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended', 'archived', 'updated'],
    default: 'pending',
    index: true,
  },

  suspendedReason: {
    type: String,
    trim: true,
  },

  suspendedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
  },

  suspendedAt: Date,

  approvalNotes: {
    type: String,
    trim: true,
  },

  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
  },

  approvedAt: Date,

  rejectionReason: {
    type: String,
    trim: true,
  },

  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
  },

  rejectedAt: Date,

  // Engagement
  views: {
    type: Number,
    default: 0,
  },

  // Ratings (maintained by Review model hooks)
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },

  reviewCount: {
    type: Number,
    default: 0,
  },

  inquiries: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
    },
    message: String,
    createdAt: { type: Date, default: Date.now },
  }],

  inquiryCount: {
    type: Number,
    default: 0,
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },

  deletedAt: Date,
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
  },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
serviceSchema.index({ provider: 1, status: 1 });
serviceSchema.index({ category: 1, status: 1 });
serviceSchema.index({ status: 1, createdAt: -1 });
serviceSchema.index({ city: 1, state: 1, status: 1 });
serviceSchema.index({ createdAt: -1, status: 1 });
serviceSchema.index({ coordinates: '2dsphere' });

// Virtual for availability
serviceSchema.virtual('isApproved').get(function() {
  return this.status === 'approved';
});

// Pre-save middleware
serviceSchema.pre('save', function(next) {
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
