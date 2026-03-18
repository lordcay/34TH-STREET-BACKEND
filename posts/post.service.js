// posts/post.service.js
const Post = require('./post.model');
const mongoose = require('mongoose');
const Account = require('../accounts/account.model');
const Connection = require('../connections/connection.model');

const postService = {
  /**
   * Create a new post
   */
  async createPost(authorId, postData) {
    const { content, images, postType, linkPreview, poll, visibility, hashtags, school, documents } = postData;
    
    // Ensure content is at least an empty string
    const safeContent = content || '';
    
    // Extract hashtags from content if not provided
    const extractedHashtags = hashtags || this.extractHashtags(safeContent);
    // Extract mentions from content (now async)
    const mentions = await this.extractMentions(safeContent);
    
    const post = new Post({
      author: authorId,
      content: safeContent,
      images: images || [],
      documents: documents || [],
      postType: postType || (poll ? 'poll' : (images?.length > 0 ? 'image' : 'text')),
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
      .populate('author', 'firstName lastName photos profileImage verified school')
      .populate('comments.userId', 'firstName lastName photos profileImage')
      .populate('comments.replies.userId', 'firstName lastName photos profileImage')
      .populate('originalPost')
      .lean();
  },
  
  /**
   * Get paginated feed posts
   */
  async getFeedPosts({ page = 1, limit = 20, userId, school }) {
    const skip = (page - 1) * limit;
    
    // Get current user's connection IDs for visibility filtering
    let connectedUserIds = [];
    if (userId) {
      const connections = await Connection.find({
        $or: [
          { requester: userId, status: 'connected' },
          { target: userId, status: 'connected' }
        ]
      }).select('requester target').lean();
      
      connectedUserIds = connections.map(c =>
        c.requester.toString() === userId.toString()
          ? c.target.toString()
          : c.requester.toString()
      );
    }
    
    const query = {
      isDeleted: { $ne: true },
      $or: [
        // Public posts: everyone can see
        { visibility: 'public' },
        // Posts with no visibility set default to public
        { visibility: { $exists: false } },
        // Own posts: always visible regardless of visibility
        ...(userId ? [{ author: userId }] : []),
        // Connections-only posts: visible if viewer is connected to author
        ...(connectedUserIds.length > 0
          ? [{ visibility: 'connections', author: { $in: connectedUserIds } }]
          : []),
      ]
    };
    
    // Optional: filter by school for school-specific feed
    if (school) {
      query.school = school;
    }
    
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName photos profileImage verified school bio')
      .populate('comments.userId', 'firstName lastName photos profileImage')
      .populate('comments.replies.userId', 'firstName lastName photos profileImage')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'author',
          select: 'firstName lastName photos profileImage verified'
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
    
    // Build visibility filter based on viewer relationship
    let visibilityFilter;
    if (viewerId && viewerId.toString() === userId.toString()) {
      // Viewing own profile — see everything
      visibilityFilter = { author: userId, isDeleted: { $ne: true } };
    } else if (viewerId) {
      // Check if viewer is connected to this user
      const isConnected = await Connection.areConnected(viewerId, userId);
      if (isConnected) {
        // Connected — see public + connections posts
        visibilityFilter = {
          author: userId,
          isDeleted: { $ne: true },
          visibility: { $in: ['public', 'connections'] }
        };
      } else {
        // Not connected — only public posts
        visibilityFilter = {
          author: userId,
          isDeleted: { $ne: true },
          $or: [
            { visibility: 'public' },
            { visibility: { $exists: false } }
          ]
        };
      }
    } else {
      // No viewer (anonymous) — only public
      visibilityFilter = {
        author: userId,
        isDeleted: { $ne: true },
        $or: [
          { visibility: 'public' },
          { visibility: { $exists: false } }
        ]
      };
    }
    
    const posts = await Post.find(visibilityFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName photos profileImage verified school')
      .populate('comments.userId', 'firstName lastName photos profileImage')
      .lean();
    
    if (viewerId) {
      posts.forEach(post => {
        post.userReaction = post.reactions.find(r => r.userId.toString() === viewerId.toString());
      });
    }
    
    const total = await Post.countDocuments(visibilityFilter);
    
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
   * Reply to a comment
   */
  async replyToComment(postId, commentId, userId, text) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    const comment = post.comments.id(commentId);
    if (!comment) throw new Error('Comment not found');
    
    // Initialize replies array if it doesn't exist
    if (!comment.replies) {
      comment.replies = [];
    }
    
    comment.replies.push({
      userId,
      text: text.trim(),
      createdAt: new Date(),
      likes: []
    });
    
    await post.save();
    return this.getPostById(postId);
  },
  
  /**
   * Like a reply
   */
  async likeReply(postId, commentId, replyIndex, userId) {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    const comment = post.comments.id(commentId);
    if (!comment) throw new Error('Comment not found');
    
    if (!comment.replies || !comment.replies[replyIndex]) {
      throw new Error('Reply not found');
    }
    
    const reply = comment.replies[replyIndex];
    const likeIndex = reply.likes.indexOf(userId);
    
    if (likeIndex > -1) {
      reply.likes.splice(likeIndex, 1);
    } else {
      reply.likes.push(userId);
    }
    
    await post.save();
    return this.getPostById(postId);
  },
  
  /**
   * Share/Repost a post
   */
  async sharePost(postId, userId, additionalContent = '', visibility = 'public') {
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
      postType: 'text',
      visibility: visibility
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
      post.mentions = await this.extractMentions(content);
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
    
    // Check if user already voted on this exact option (toggle off)
    const currentOption = post.poll.options[optionIndex];
    if (!currentOption) throw new Error('Invalid option');
    
    const alreadyVotedThis = currentOption.votes.indexOf(userId) > -1;
    
    // Remove previous vote from all options
    post.poll.options.forEach(option => {
      const voteIndex = option.votes.indexOf(userId);
      if (voteIndex > -1) {
        option.votes.splice(voteIndex, 1);
      }
    });
    
    // If user tapped a different option (or first vote), add the vote
    // If user tapped the same option they already voted on, just remove (toggle off)
    if (!alreadyVotedThis) {
      currentOption.votes.push(userId);
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
    
    // Use partial matching - match hashtags that START WITH or CONTAIN the search term
    const posts = await Post.find({
      $or: [
        // Match hashtags that contain the search term (partial match)
        { hashtags: { $regex: new RegExp(cleanTag, 'i') } },
        // Also match content that contains the hashtag
        { content: { $regex: new RegExp(`#${cleanTag}`, 'i') } }
      ],
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName photos profileImage verified')
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
    if (!content) return [];
    const matches = content.match(/#[\w]+/g) || [];
    return [...new Set(matches.map(t => t.toLowerCase().replace('#', '')))];
  },
  
  /**
   * Extract mentions from content
   * Matches @FirstnameLastname or @Firstname patterns
   * Returns array of user ObjectIds
   */
  async extractMentions(content) {
    if (!content) return [];
    
    // Match @followed by word characters (allows multiple words for full names)
    // Pattern: @word or @word_word (underscores for spaces)
    const matches = content.match(/@[\w]+(?:_[\w]+)?/g) || [];
    
    if (matches.length === 0) return [];
    
    const mentionNames = matches.map(m => m.slice(1)); // Remove @
    const userIds = [];
    
    for (const name of mentionNames) {
      // Try to find user by name (firstName_lastName or firstName)
      const nameParts = name.split('_');
      
      let user;
      if (nameParts.length >= 2) {
        // Try firstName_lastName match
        user = await Account.findOne({
          firstName: { $regex: new RegExp(`^${nameParts[0]}$`, 'i') },
          lastName: { $regex: new RegExp(`^${nameParts.slice(1).join(' ')}$`, 'i') }
        }).select('_id');
      }
      
      if (!user) {
        // Try firstName only match (for unique first names)
        user = await Account.findOne({
          firstName: { $regex: new RegExp(`^${nameParts[0]}$`, 'i') }
        }).select('_id');
      }
      
      if (user && !userIds.some(id => id.equals(user._id))) {
        userIds.push(user._id);
      }
    }
    
    return userIds;
  }
};

module.exports = postService;
