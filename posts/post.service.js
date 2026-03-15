// posts/post.service.js
const Post = require('./post.model');
const mongoose = require('mongoose');

const postService = {
  /**
   * Create a new post
   */
  async createPost(authorId, postData) {
    const { content, images, postType, linkPreview, poll, visibility, hashtags, school } = postData;
    
    // Extract hashtags from content if not provided
    const extractedHashtags = hashtags || this.extractHashtags(content);
    // Extract mentions from content
    const mentions = this.extractMentions(content);
    
    const post = new Post({
      author: authorId,
      content,
      images: images || [],
      postType: postType || (images?.length > 0 ? 'image' : 'text'),
      linkPreview,
      poll,
      visibility: visibility || 'public',
      hashtags: extractedHashtags,
      mentions,
      school
    });
    
    await post.save();
    return this.getPostById(post._id);
  },
  
  /**
   * Get a single post by ID with author populated
   */
  async getPostById(postId) {
    return Post.findById(postId)
      .populate('author', 'firstName lastName profileImage verified school')
      .populate('comments.userId', 'firstName lastName profileImage')
      .populate('originalPost')
      .lean();
  },
  
  /**
   * Get paginated feed posts
   */
  async getFeedPosts({ page = 1, limit = 20, userId, school }) {
    const skip = (page - 1) * limit;
    
    const query = { isDeleted: { $ne: true } };
    
    // Optional: filter by school for school-specific feed
    if (school) {
      query.$or = [
        { school },
        { visibility: 'public' }
      ];
    }
    
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName profileImage verified school bio')
      .populate('comments.userId', 'firstName lastName profileImage')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'author',
          select: 'firstName lastName profileImage verified'
        }
      })
      .lean();
    
    // Add user-specific data (whether current user has reacted)
    if (userId) {
      posts.forEach(post => {
        post.userReaction = post.reactions.find(r => r.userId.toString() === userId.toString());
        post.hasShared = post.shares.some(s => s.toString() === userId.toString());
      });
    }
    
    const total = await Post.countDocuments(query);
    
    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total
      }
    };
  },
  
  /**
   * Get posts by a specific user
   */
  async getUserPosts({ userId, page = 1, limit = 20, viewerId }) {
    const skip = (page - 1) * limit;
    
    const posts = await Post.find({ 
      author: userId, 
      isDeleted: { $ne: true } 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName profileImage verified school')
      .populate('comments.userId', 'firstName lastName profileImage')
      .lean();
    
    if (viewerId) {
      posts.forEach(post => {
        post.userReaction = post.reactions.find(r => r.userId.toString() === viewerId.toString());
      });
    }
    
    const total = await Post.countDocuments({ author: userId, isDeleted: { $ne: true } });
    
    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total
      }
    };
  },
  
  /**
   * Add or update reaction to a post
   */
  async reactToPost(postId, userId, reactionType = 'like') {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    // Check if user already reacted
    const existingReactionIndex = post.reactions.findIndex(
      r => r.userId.toString() === userId.toString()
    );
    
    if (existingReactionIndex > -1) {
      const existingType = post.reactions[existingReactionIndex].type;
      
      if (existingType === reactionType) {
        // Same reaction - remove it (toggle off)
        post.reactions.splice(existingReactionIndex, 1);
        post.reactionCounts[existingType]--;
        post.reactionCounts.total--;
      } else {
        // Different reaction - update it
        post.reactionCounts[existingType]--;
        post.reactions[existingReactionIndex].type = reactionType;
        post.reactions[existingReactionIndex].createdAt = new Date();
        post.reactionCounts[reactionType]++;
      }
    } else {
      // New reaction
      post.reactions.push({ userId, type: reactionType });
      post.reactionCounts[reactionType]++;
      post.reactionCounts.total++;
    }
    
    await post.save();
    return this.getPostById(postId);
  },
  
  /**
   * Remove reaction from a post
   */
  async removeReaction(postId, userId) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    const reactionIndex = post.reactions.findIndex(
      r => r.userId.toString() === userId.toString()
    );
    
    if (reactionIndex > -1) {
      const reactionType = post.reactions[reactionIndex].type;
      post.reactions.splice(reactionIndex, 1);
      post.reactionCounts[reactionType]--;
      post.reactionCounts.total--;
      await post.save();
    }
    
    return this.getPostById(postId);
  },
  
  /**
   * Add a comment to a post
   */
  async addComment(postId, userId, text) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    post.comments.push({ userId, text });
    post.commentCount++;
    await post.save();
    
    return this.getPostById(postId);
  },
  
  /**
   * Delete a comment
   */
  async deleteComment(postId, commentId, userId) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    const commentIndex = post.comments.findIndex(
      c => c._id.toString() === commentId &&
           c.userId.toString() === userId.toString()
    );
    
    if (commentIndex === -1) {
      throw new Error('Comment not found or not authorized');
    }
    
    post.comments.splice(commentIndex, 1);
    post.commentCount--;
    await post.save();
    
    return this.getPostById(postId);
  },
  
  /**
   * Like a comment
   */
  async likeComment(postId, commentId, userId) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    const comment = post.comments.id(commentId);
    if (!comment) throw new Error('Comment not found');
    
    const likeIndex = comment.likes.indexOf(userId);
    if (likeIndex > -1) {
      comment.likes.splice(likeIndex, 1);
    } else {
      comment.likes.push(userId);
    }
    
    await post.save();
    return this.getPostById(postId);
  },
  
  /**
   * Share/Repost a post
   */
  async sharePost(postId, userId, additionalContent = '') {
    const originalPost = await Post.findById(postId);
    if (!originalPost) throw new Error('Post not found');
    
    // Track share on original post
    if (!originalPost.shares.includes(userId)) {
      originalPost.shares.push(userId);
      originalPost.shareCount++;
      await originalPost.save();
    }
    
    // Create repost
    const repost = new Post({
      author: userId,
      content: additionalContent,
      originalPost: postId,
      isRepost: true,
      postType: 'text'
    });
    
    await repost.save();
    return this.getPostById(repost._id);
  },
  
  /**
   * Update a post
   */
  async updatePost(postId, userId, updateData) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    if (post.author.toString() !== userId.toString()) {
      throw new Error('Not authorized to update this post');
    }
    
    const { content, images, visibility } = updateData;
    
    if (content !== undefined) {
      post.content = content;
      post.hashtags = this.extractHashtags(content);
      post.mentions = this.extractMentions(content);
    }
    if (images !== undefined) post.images = images;
    if (visibility !== undefined) post.visibility = visibility;
    
    await post.save();
    return this.getPostById(postId);
  },
  
  /**
   * Delete a post (soft delete)
   */
  async deletePost(postId, userId) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    if (post.author.toString() !== userId.toString()) {
      throw new Error('Not authorized to delete this post');
    }
    
    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();
    
    return { success: true, message: 'Post deleted successfully' };
  },
  
  /**
   * Vote on a poll option
   */
  async votePoll(postId, userId, optionIndex) {
    const post = await Post.findById(postId);
    if (!post || post.postType !== 'poll') throw new Error('Poll not found');
    
    if (post.poll.endsAt && new Date() > new Date(post.poll.endsAt)) {
      throw new Error('Poll has ended');
    }
    
    // Remove previous vote if any
    post.poll.options.forEach(option => {
      const voteIndex = option.votes.indexOf(userId);
      if (voteIndex > -1) {
        option.votes.splice(voteIndex, 1);
      }
    });
    
    // Add new vote
    if (post.poll.options[optionIndex]) {
      post.poll.options[optionIndex].votes.push(userId);
    }
    
    await post.save();
    return this.getPostById(postId);
  },
  
  /**
   * Increment view count
   */
  async incrementViewCount(postId) {
    await Post.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } });
  },
  
  /**
   * Search posts by hashtag
   */
  async searchByHashtag(hashtag, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const cleanTag = hashtag.replace('#', '').toLowerCase();
    
    const posts = await Post.find({
      hashtags: { $regex: new RegExp(`^${cleanTag}$`, 'i') },
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName profileImage verified')
      .lean();
    
    return posts;
  },
  
  /**
   * Get trending hashtags
   */
  async getTrendingHashtags(limit = 10) {
    const result = await Post.aggregate([
      { $match: { isDeleted: { $ne: true }, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    
    return result.map(r => ({ hashtag: r._id, count: r.count }));
  },
  
  /**
   * Extract hashtags from content
   */
  extractHashtags(content) {
    const matches = content.match(/#[\w]+/g) || [];
    return [...new Set(matches.map(t => t.toLowerCase().replace('#', '')))];
  },
  
  /**
   * Extract mentions from content
   */
  extractMentions(content) {
    // This would need to be enhanced to look up actual user IDs
    // For now, just extract the patterns
    const matches = content.match(/@[\w]+/g) || [];
    return [];
  }
};

module.exports = postService;
