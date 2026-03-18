// posts/post.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Reaction sub-schema for rich reactions
const reactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  type: { 
    type: String, 
    enum: ['like', 'love', 'celebrate', 'insightful', 'fire'],
    default: 'like'
  },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Comment sub-schema
const commentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
  likes: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
  // Replies to comments (flat, single level - like LinkedIn)
  replies: [{
    userId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    text: { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
    likes: [{ type: Schema.Types.ObjectId, ref: 'Account' }]
  }]
});

const postSchema = new Schema({
  // Author
  author: { 
    type: Schema.Types.ObjectId, 
    ref: 'Account', 
    required: true,
    index: true
  },
  
  // Content (optional - can post with just images or just text)
  content: { 
    type: String, 
    required: false,
    maxlength: 3000,
    trim: true,
    default: ''
  },
  
  // Media attachments (images, etc.)
  images: [{ type: String }], // Array of image URLs
  
  // Document attachments
  documents: [{
    url: { type: String, required: true },
    name: { type: String },
    size: { type: Number },
    mimeType: { type: String }
  }],
  
  // Post type
  postType: {
    type: String,
    enum: ['text', 'image', 'link', 'poll', 'achievement', 'question'],
    default: 'text'
  },
  
  // For link posts
  linkPreview: {
    url: { type: String },
    title: { type: String },
    description: { type: String },
    image: { type: String }
  },
  
  // For poll posts
  poll: {
    question: { type: String },
    options: [{
      text: { type: String },
      votes: [{ type: Schema.Types.ObjectId, ref: 'Account' }]
    }],
    endsAt: { type: Date }
  },
  
  // Reactions (like LinkedIn's multiple reaction types)
  reactions: [reactionSchema],
  reactionCounts: {
    like: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    celebrate: { type: Number, default: 0 },
    insightful: { type: Number, default: 0 },
    fire: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // Comments
  comments: [commentSchema],
  commentCount: { type: Number, default: 0 },
  
  // Shares/Reposts
  shares: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
  shareCount: { type: Number, default: 0 },
  
  // Original post (if this is a repost)
  originalPost: { type: Schema.Types.ObjectId, ref: 'Post' },
  isRepost: { type: Boolean, default: false },
  
  // Visibility
  visibility: {
    type: String,
    enum: ['public', 'connections', 'school', 'private'],
    default: 'public'
  },
  
  // Tags/Mentions
  mentions: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
  hashtags: [{ type: String }],
  
  // School association (for school-specific feeds)
  school: { type: String, index: true },
  
  // Engagement tracking
  viewCount: { type: Number, default: 0 },
  
  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
  
}, { timestamps: true });

// Indexes for efficient queries
postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ school: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ 'reactionCounts.total': -1 });

// Virtual for total engagement
postSchema.virtual('engagement').get(function() {
  return this.reactionCounts.total + this.commentCount + this.shareCount;
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
