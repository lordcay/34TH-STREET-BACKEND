// services/service.controller.js
const Service = require('./service.model');
const Review = require('./review.model');
const Connection = require('../connections/connection.model');

module.exports = {
  // Public endpoints
  getApprovedServices,
  getServicesByCategory,
  searchServices,
  getServiceById,

  // User endpoints
  createService,
  getMyServices,
  updateService,
  deleteService,
  getMyServiceById,

  // Review endpoints
  createReview,
  getServiceReviews,
  getReviewStats,

  // Admin endpoints
  getPendingServices,
  approveService,
  rejectService,
  getAllServices,
  suspendService,
  unsuspendService,
  adminDeleteService,
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Build query filters with performance optimization
 */
const buildServiceQuery = (filters = {}) => {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  } else {
    query.status = 'approved'; // Default to approved only
  }

  if (!filters.includeDeleted) {
    query.isDeleted = false;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.city) {
    query.city = new RegExp(filters.city, 'i');
  }

  if (filters.state) {
    query.state = filters.state;
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    query.$or = [];
    if (filters.minPrice !== undefined) {
      query.$or.push({ hourlyRate: { $gte: filters.minPrice } });
      query.$or.push({ basePrice: { $gte: filters.minPrice } });
    }
    if (filters.maxPrice !== undefined) {
      query.$or.push({ hourlyRate: { $lte: filters.maxPrice } });
      query.$or.push({ basePrice: { $lte: filters.maxPrice } });
    }
  }

  if (filters.providerId) {
    query.provider = filters.providerId;
  }

  return query;
};

/**
 * Calculate pagination metadata
 */
const getPaginationMeta = (page, limit, total) => {
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    pages: Math.ceil(total / parseInt(limit)),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
};

/**
 * Format service response
 */
const formatService = (service) => {
  const serviceObj = service.toObject ? service.toObject() : service;
  return {
    _id: serviceObj._id,
    title: serviceObj.title,
    description: serviceObj.description,
    category: serviceObj.category,
    subcategory: serviceObj.subcategory,
    experience: serviceObj.experience,
    skills: serviceObj.skills || [],
    pricing: serviceObj.pricing,
    hourlyRate: serviceObj.hourlyRate,
    basePrice: serviceObj.basePrice,
    serviceLocation: serviceObj.serviceLocation,
    fullAddress: serviceObj.fullAddress,
    coordinates: serviceObj.coordinates || null,
    city: serviceObj.city,
    state: serviceObj.state,
    contactEmail: serviceObj.contactEmail,
    contactPhone: serviceObj.contactPhone,
    website: serviceObj.website,
    instagram: serviceObj.instagram,
    facebook: serviceObj.facebook,
    twitter: serviceObj.twitter,
    linkedin: serviceObj.linkedin,
    provider: serviceObj.provider,
    status: serviceObj.status,
    averageRating: serviceObj.averageRating || 0,
    reviewCount: serviceObj.reviewCount || 0,
    views: serviceObj.views,
    inquiryCount: serviceObj.inquiryCount || 0,
    approvalNotes: serviceObj.approvalNotes,
    approvedBy: serviceObj.approvedBy,
    approvedAt: serviceObj.approvedAt,
    rejectionReason: serviceObj.rejectionReason,
    rejectedBy: serviceObj.rejectedBy,
    rejectedAt: serviceObj.rejectedAt,
    suspendedReason: serviceObj.suspendedReason,
    suspendedBy: serviceObj.suspendedBy,
    suspendedAt: serviceObj.suspendedAt,
    createdAt: serviceObj.createdAt,
    updatedAt: serviceObj.updatedAt,
  };
};

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get all approved services (for browse screen)
 */
async function getApprovedServices(req, res, next) {
  try {
    const { page = 1, limit = 20, category, city, state, maxPrice, search } = req.query;

    const query = buildServiceQuery({
      status: 'approved',
      includeDeleted: false,
      category,
      city,
      state,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    });

    // Add search filter for title and description
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { skills: new RegExp(search, 'i') },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [services, total] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName profilePicture email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Service.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: services.map(formatService),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get services by category
 */
async function getServicesByCategory(req, res, next) {
  try {
    const { category, page = 1, limit = 20 } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required',
      });
    }

    const query = buildServiceQuery({
      status: 'approved',
      includeDeleted: false,
      category,
    });

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [services, total] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName profilePicture email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Service.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: services.map(formatService),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Search services with multiple filters
 */
async function searchServices(req, res, next) {
  try {
    const { q, page = 1, limit = 20, category, city, state, maxPrice } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const query = buildServiceQuery({
      status: 'approved',
      includeDeleted: false,
      category,
      city,
      state,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    });

    // Multi-field search
    query.$or = [
      { title: new RegExp(q, 'i') },
      { description: new RegExp(q, 'i') },
      { skills: new RegExp(q, 'i') },
    ];

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [services, total] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName profilePicture email')
        .sort({ _score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Service.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: services.map(formatService),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single service by ID
 */
async function getServiceById(req, res, next) {
  try {
    const { id } = req.params;

    const service = await Service.findOne({
      _id: id,
      status: 'approved',
      isDeleted: false,
    })
      .populate('provider', 'firstName lastName profilePicture email connections')
      .lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Increment view count (non-blocking)
    Service.findByIdAndUpdate(id, { $inc: { views: 1 } }).catch();

    res.json({
      success: true,
      data: formatService(service),
    });
  } catch (error) {
    next(error);
  }
}

// ==================== USER ENDPOINTS ====================

/**
 * Create new service (submits as pending)
 */
async function createService(req, res, next) {
  try {
    const {
      title, description, category, subcategory, experience, skills,
      pricing, hourlyRate, basePrice,
      serviceLocation, fullAddress, city, state,
      contactEmail, contactPhone,
      website, instagram, facebook, twitter, linkedin,
    } = req.body;

    // Validation
    const errors = {};
    if (!title?.trim()) errors.title = 'Title is required';
    if (!description?.trim()) errors.description = 'Description is required';
    if (!category) errors.category = 'Category is required';
    if (!serviceLocation?.trim()) errors.serviceLocation = 'Service location is required';
    if (!fullAddress?.trim()) errors.fullAddress = 'Full address is required';
    if (!contactEmail?.trim()) errors.contactEmail = 'Contact email is required';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Enforce maximum 3 services per user
    const existingCount = await Service.countDocuments({
      provider: req.user.id,
      isDeleted: false,
    });

    if (existingCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'You can create a maximum of 3 services. Please delete an existing service before creating a new one.',
      });
    }

    // Prevent duplicate services (same title by same provider)
    const duplicate = await Service.findOne({
      provider: req.user.id,
      title: { $regex: new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      isDeleted: false,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'You already have a service with this title. Please use a different title or edit your existing service.',
      });
    }

    const newService = new Service({
      title: title.trim(),
      description: description.trim(),
      category,
      subcategory,
      experience,
      skills: skills || [],
      pricing: pricing?.trim() || null,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      basePrice: basePrice ? parseFloat(basePrice) : null,
      serviceLocation: serviceLocation.trim(),
      fullAddress: fullAddress.trim(),
      city: city?.trim() || '',
      state: state || '',
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone?.trim() || '',
      website: website?.trim() || '',
      instagram: instagram?.trim() || '',
      facebook: facebook?.trim() || '',
      twitter: twitter?.trim() || '',
      linkedin: linkedin?.trim() || '',
      provider: req.user.id,
      status: 'pending',
    });

    // Store coordinates if provided by mobile client
    if (req.body.latitude && req.body.longitude) {
      newService.coordinates = {
        type: 'Point',
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)],
      };
    }

    await newService.save();

    const populatedService = await newService.populate('provider', 'firstName lastName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Service created and pending admin approval',
      data: formatService(populatedService),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's services (all states)
 */
async function getMyServices(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      provider: req.user.id,
      isDeleted: false,
    };

    if (status) {
      query.status = status;
    }

    const [services, total] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Service.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: services.map(formatService),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific service for user
 */
async function getMyServiceById(req, res, next) {
  try {
    const { id } = req.params;

    const service = await Service.findOne({
      _id: id,
      provider: req.user.id,
      isDeleted: false,
    })
      .populate('provider', 'firstName lastName profilePicture')
      .lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      data: formatService(service),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update service (resets to pending if already approved)
 */
async function updateService(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title, description, category, subcategory, experience, skills,
      pricing, hourlyRate, basePrice,
      serviceLocation, fullAddress, city, state,
      contactEmail, contactPhone,
      website, instagram, facebook, twitter, linkedin,
    } = req.body;

    const service = await Service.findOne({
      _id: id,
      provider: req.user.id,
      isDeleted: false,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Update fields
    if (title?.trim()) service.title = title.trim();
    if (description?.trim()) service.description = description.trim();
    if (category) service.category = category;
    if (subcategory) service.subcategory = subcategory;
    if (experience !== undefined) service.experience = experience;
    if (skills) service.skills = skills;
    if (pricing !== undefined) service.pricing = pricing?.trim() || null;
    if (hourlyRate !== undefined) service.hourlyRate = hourlyRate ? parseFloat(hourlyRate) : null;
    if (basePrice !== undefined) service.basePrice = basePrice ? parseFloat(basePrice) : null;
    if (serviceLocation?.trim()) service.serviceLocation = serviceLocation.trim();
    if (fullAddress?.trim()) service.fullAddress = fullAddress.trim();
    if (city !== undefined) service.city = city?.trim() || '';
    if (state !== undefined) service.state = state || '';
    if (contactEmail?.trim()) service.contactEmail = contactEmail.trim();
    if (contactPhone !== undefined) service.contactPhone = contactPhone?.trim() || '';
    if (website !== undefined) service.website = website?.trim() || '';
    if (instagram !== undefined) service.instagram = instagram?.trim() || '';
    if (facebook !== undefined) service.facebook = facebook?.trim() || '';
    if (twitter !== undefined) service.twitter = twitter?.trim() || '';
    if (linkedin !== undefined) service.linkedin = linkedin?.trim() || '';

    // Update coordinates if provided
    if (req.body.latitude && req.body.longitude) {
      service.coordinates = {
        type: 'Point',
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)],
      };
    }

    // Mark as 'updated' for admin re-review if was approved
    if (service.status === 'approved') {
      service.status = 'updated';
    }

    await service.save();
    const populatedService = await service.populate('provider', 'firstName lastName profilePicture');

    res.json({
      success: true,
      message: service.status === 'updated'
        ? 'Service updated. Changes are pending admin re-review.'
        : 'Service updated successfully.',
      data: formatService(populatedService),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete (soft delete) service
 */
async function deleteService(req, res, next) {
  try {
    const { id } = req.params;

    const service = await Service.findOneAndUpdate(
      {
        _id: id,
        provider: req.user.id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user.id,
      },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get pending services (admin only)
 */
async function getPendingServices(req, res, next) {
  try {
    // Check if user is admin (should be enforced by middleware)
    const { page = 1, limit = 20, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      status: 'pending',
      isDeleted: false,
    };

    if (category) {
      query.category = category;
    }

    const [services, total] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName profilePicture email')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Service.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: services.map(formatService),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve service (admin)
 */
async function approveService(req, res, next) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const service = await Service.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        approvalNotes: notes || '',
      },
      { new: true }
    ).populate('provider', 'firstName lastName profilePicture email');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service approved successfully',
      data: formatService(service),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject service (admin)
 */
async function rejectService(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const service = await Service.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        rejectedBy: req.user.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      { new: true }
    ).populate('provider', 'firstName lastName profilePicture email');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service rejected',
      data: formatService(service),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all services (admin)
 */
async function getAllServices(req, res, next) {
  try {
    const { page = 1, limit = 20, status, category, providerId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { isDeleted: false };

    if (status) query.status = status;
    if (category) query.category = category;
    if (providerId) query.provider = providerId;

    const [services, total] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName profilePicture email')
        .populate('approvedBy', 'firstName lastName')
        .populate('rejectedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Service.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: services.map(formatService),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Suspend an approved service (admin)
 */
async function suspendService(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Suspension reason is required',
      });
    }

    const service = await Service.findByIdAndUpdate(
      id,
      {
        status: 'suspended',
        suspendedBy: req.user.id,
        suspendedAt: new Date(),
        suspendedReason: reason,
      },
      { new: true }
    ).populate('provider', 'firstName lastName profilePicture email');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service suspended',
      data: formatService(service),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unsuspend (reactivate) a suspended service (admin)
 */
async function unsuspendService(req, res, next) {
  try {
    const { id } = req.params;

    const service = await Service.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        suspendedBy: null,
        suspendedAt: null,
        suspendedReason: null,
      },
      { new: true }
    ).populate('provider', 'firstName lastName profilePicture email');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service reactivated',
      data: formatService(service),
    });
  } catch (error) {
    next(error);
  }
}

// ==================== REVIEW ENDPOINTS ====================

/**
 * Create or update a review for a service
 */
async function createReview(req, res, next) {
  try {
    const { id } = req.params;
    const { rating, text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const service = await Service.findOne({ _id: id, status: 'approved', isDeleted: false });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Prevent reviewing own service
    if (service.provider.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot review your own service' });
    }

    // Upsert: create or update
    const review = await Review.findOneAndUpdate(
      { service: id, reviewer: req.user.id },
      { rating, text: text?.trim() || '' },
      { new: true, upsert: true, runValidators: true }
    ).populate('reviewer', 'firstName lastName profilePicture');

    // Manually recalculate ratings (findOneAndUpdate doesn't trigger post-save hooks)
    await Review.calcAverageRating(service._id);

    // Get updated service ratings
    const updatedService = await Service.findById(id).select('averageRating reviewCount').lean();

    res.status(201).json({
      success: true,
      message: 'Review submitted',
      data: {
        _id: review._id,
        rating: review.rating,
        text: review.text,
        reviewer: review.reviewer,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        serviceRating: {
          averageRating: updatedService?.averageRating || 0,
          reviewCount: updatedService?.reviewCount || 0,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You already reviewed this service' });
    }
    next(error);
  }
}

/**
 * Get reviews for a service
 */
async function getServiceReviews(req, res, next) {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const currentUserId = req.user?.id;

    const [reviews, total] = await Promise.all([
      Review.find({ service: id })
        .populate('reviewer', 'firstName lastName photos')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Review.countDocuments({ service: id }),
    ]);

    // Enrich reviews with connection data for each reviewer
    const enrichedReviews = await Promise.all(
      reviews.map(async (r) => {
        const reviewerId = r.reviewer?._id;
        let connectionStatus = 'none';
        let connectionCount = 0;

        if (reviewerId) {
          const [status, count] = await Promise.all([
            currentUserId && String(reviewerId) !== String(currentUserId)
              ? Connection.getStatus(currentUserId, reviewerId)
              : Promise.resolve('self'),
            Connection.countDocuments({
              $or: [
                { requester: reviewerId, status: 'connected' },
                { target: reviewerId, status: 'connected' },
              ],
            }),
          ]);
          connectionStatus = status;
          connectionCount = count;
        }

        return {
          _id: r._id,
          rating: r.rating,
          text: r.text,
          reviewer: r.reviewer,
          createdAt: r.createdAt,
          connectionStatus,
          connectionCount,
        };
      })
    );

    res.json({
      success: true,
      data: enrichedReviews,
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
}

// ==================== ADMIN DELETE ====================

/**
 * Admin delete service (soft delete any service)
 */
async function adminDeleteService(req, res, next) {
  try {
    const { id } = req.params;

    const service = await Service.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user.id,
      },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service deleted by admin',
    });
  } catch (error) {
    next(error);
  }
}

// ==================== REVIEW STATS ====================

/**
 * Get review statistics for a service (star distribution, weighted rating)
 * Uses Bayesian averaging (like Amazon/IMDb) for fairer rankings
 */
async function getReviewStats(req, res, next) {
  try {
    const { id } = req.params;

    const stats = await Review.aggregate([
      { $match: { service: new (require('mongoose').Types.ObjectId)(id) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    // Build distribution object { 5: count, 4: count, ... }
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalReviews = 0;
    let sumRatings = 0;

    stats.forEach((s) => {
      distribution[s._id] = s.count;
      totalReviews += s.count;
      sumRatings += s._id * s.count;
    });

    // Simple average
    const simpleAverage = totalReviews > 0 ? sumRatings / totalReviews : 0;

    // Bayesian weighted average (prevents 1 review of 5 stars ranking above 50 reviews of 4.8)
    // Formula: (C * m + sum) / (C + n)
    // C = minimum reviews threshold, m = global prior mean (3.0)
    const C = 5; // weight constant (tunable)
    const m = 3.0; // prior mean
    const bayesianAverage = totalReviews > 0
      ? (C * m + sumRatings) / (C + totalReviews)
      : 0;

    // Percentage distribution per star
    const percentages = {};
    for (let star = 5; star >= 1; star--) {
      percentages[star] = totalReviews > 0
        ? Math.round((distribution[star] / totalReviews) * 100)
        : 0;
    }

    res.json({
      success: true,
      data: {
        totalReviews,
        simpleAverage: Math.round(simpleAverage * 10) / 10,
        bayesianAverage: Math.round(bayesianAverage * 10) / 10,
        distribution,
        percentages,
      },
    });
  } catch (error) {
    next(error);
  }
}
