// services/review.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service is required'],
    index: true,
  },

  reviewer: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'Reviewer is required'],
    index: true,
  },

  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
  },

  text: {
    type: String,
    maxlength: [1000, 'Review text cannot exceed 1000 characters'],
    trim: true,
  },
}, {
  timestamps: true,
});

// Compound index: one review per user per service
reviewSchema.index({ service: 1, reviewer: 1 }, { unique: true });

// Static method to recalculate average for a service
reviewSchema.statics.calcAverageRating = async function(serviceId) {
  const stats = await this.aggregate([
    { $match: { service: serviceId } },
    {
      $group: {
        _id: '$service',
        avgRating: { $avg: '$rating' },
        count: { $count: {} },
      },
    },
  ]);

  const Service = mongoose.model('Service');
  if (stats.length > 0) {
    await Service.findByIdAndUpdate(serviceId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].count,
    });
  } else {
    await Service.findByIdAndUpdate(serviceId, {
      averageRating: 0,
      reviewCount: 0,
    });
  }
};

// Recalculate after save / remove
reviewSchema.post('save', function() {
  this.constructor.calcAverageRating(this.service);
});

reviewSchema.post('findOneAndDelete', function(doc) {
  if (doc) {
    doc.constructor.calcAverageRating(doc.service);
  }
});

module.exports = mongoose.model('Review', reviewSchema);
