// posts/post.controller.js
const postService = require('./post.service');

const postController = {
  /**
   * Create a new post
   * POST /posts
   */
  async createPost(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const postData = {
        content: req.body.content,
        images: req.body.images,
        postType: req.body.postType,
        linkPreview: req.body.linkPreview,
        poll: req.body.poll,
        visibility: req.body.visibility,
        hashtags: req.body.hashtags,
        school: req.body.school || req.user.school
      };
      
      const post = await postService.createPost(userId, postData);
      
      // Emit socket event for real-time updates
      if (req.io) {
        req.io.emit('post:created', { post });
      }
      
      res.status(201).json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Get feed posts
   * GET /posts/feed
   */
  async getFeed(req, res) {
    try {
      const userId = req.user?._id || req.user?.id;
      const { page = 1, limit = 20, school } = req.query;
      
      const result = await postService.getFeedPosts({
        page: parseInt(page),
        limit: parseInt(limit),
        userId,
        school
      });
      
      res.json({
        success: true,
        data: result.posts,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get feed error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Get a single post
   * GET /posts/:postId
   */
  async getPost(req, res) {
    try {
      const { postId } = req.params;
      const post = await postService.getPostById(postId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      // Increment view count
      await postService.incrementViewCount(postId);
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Get post error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Get posts by user
   * GET /posts/user/:userId
   */
  async getUserPosts(req, res) {
    try {
      const { userId } = req.params;
      const viewerId = req.user?._id || req.user?.id;
      const { page = 1, limit = 20 } = req.query;
      
      const result = await postService.getUserPosts({
        userId,
        page: parseInt(page),
        limit: parseInt(limit),
        viewerId
      });
      
      res.json({
        success: true,
        data: result.posts,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get user posts error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * React to a post
   * POST /posts/:postId/react
   */
  async reactToPost(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      const { type = 'like' } = req.body;
      
      const post = await postService.reactToPost(postId, userId, type);
      
      // Emit socket event
      if (req.io) {
        req.io.emit('post:reacted', { postId, userId, type, post });
      }
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('React to post error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Remove reaction from a post
   * DELETE /posts/:postId/react
   */
  async removeReaction(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      
      const post = await postService.removeReaction(postId, userId);
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Remove reaction error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Add a comment to a post
   * POST /posts/:postId/comments
   */
  async addComment(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      const { text } = req.body;
      
      if (!text || text.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Comment text is required'
        });
      }
      
      const post = await postService.addComment(postId, userId, text);
      
      // Emit socket event
      if (req.io) {
        req.io.emit('post:commented', { postId, userId, text, post });
      }
      
      res.status(201).json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Add comment error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Delete a comment
   * DELETE /posts/:postId/comments/:commentId
   */
  async deleteComment(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId, commentId } = req.params;
      
      const post = await postService.deleteComment(postId, commentId, userId);
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Like a comment
   * POST /posts/:postId/comments/:commentId/like
   */
  async likeComment(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId, commentId } = req.params;
      
      const post = await postService.likeComment(postId, commentId, userId);
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Like comment error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Share/Repost a post
   * POST /posts/:postId/share
   */
  async sharePost(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      const { content = '' } = req.body;
      
      const repost = await postService.sharePost(postId, userId, content);
      
      // Emit socket event
      if (req.io) {
        req.io.emit('post:shared', { postId, userId, repost });
      }
      
      res.status(201).json({
        success: true,
        data: repost
      });
    } catch (error) {
      console.error('Share post error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Update a post
   * PUT /posts/:postId
   */
  async updatePost(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      const updateData = {
        content: req.body.content,
        images: req.body.images,
        visibility: req.body.visibility
      };
      
      const post = await postService.updatePost(postId, userId, updateData);
      
      // Emit socket event
      if (req.io) {
        req.io.emit('post:updated', { postId, post });
      }
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Update post error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Delete a post
   * DELETE /posts/:postId
   */
  async deletePost(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      
      const result = await postService.deletePost(postId, userId);
      
      // Emit socket event
      if (req.io) {
        req.io.emit('post:deleted', { postId });
      }
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Vote on a poll
   * POST /posts/:postId/poll/vote
   */
  async votePoll(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      const { optionIndex } = req.body;
      
      if (optionIndex === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Option index is required'
        });
      }
      
      const post = await postService.votePoll(postId, userId, optionIndex);
      
      // Emit socket event
      if (req.io) {
        req.io.emit('poll:voted', { postId, post });
      }
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Vote poll error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Search posts by hashtag
   * GET /posts/search/hashtag/:hashtag
   */
  async searchByHashtag(req, res) {
    try {
      const { hashtag } = req.params;
      const { page = 1, limit = 20 } = req.query;
      
      const posts = await postService.searchByHashtag(
        hashtag,
        parseInt(page),
        parseInt(limit)
      );
      
      res.json({
        success: true,
        data: posts
      });
    } catch (error) {
      console.error('Search by hashtag error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Get trending hashtags
   * GET /posts/trending/hashtags
   */
  async getTrendingHashtags(req, res) {
    try {
      const { limit = 10 } = req.query;
      const hashtags = await postService.getTrendingHashtags(parseInt(limit));
      
      res.json({
        success: true,
        data: hashtags
      });
    } catch (error) {
      console.error('Get trending hashtags error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = postController;
