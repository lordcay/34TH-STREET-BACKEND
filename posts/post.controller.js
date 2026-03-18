// posts/post.controller.js
const postService = require('./post.service');
const db = require('../_helpers/db');
const Account = db.Account;
const { createNotification } = require('../notifications/notification.controller');

// Expo Push Notification helper
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(pushToken, title, body, data = {}, channelId = 'posts') {
  if (!pushToken || (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken['))) {
    return null;
  }
  
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: channelId
      })
    });
    
    const result = await response.json();
    console.log('📤 Notification sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Notification failed:', error);
    return null;
  }
}

const postController = {
  /**
   * Create a new post
   * POST /posts
   */
  async createPost(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { content, images } = req.body;
      
      // Validate: must have at least content OR images OR poll OR documents
      const hasContent = content && content.trim().length > 0;
      const hasImages = images && Array.isArray(images) && images.length > 0;
      const hasPoll = req.body.poll && req.body.poll.question && req.body.poll.options?.length >= 2;
      const hasDocs = req.body.documents && Array.isArray(req.body.documents) && req.body.documents.length > 0;
      
      if (!hasContent && !hasImages && !hasPoll && !hasDocs) {
        return res.status(400).json({
          success: false,
          error: 'Post must have content, images, a poll, or documents'
        });
      }
      
      const postData = {
        content: content || '',
        images: images || [],
        documents: req.body.documents || [],
        postType: req.body.postType || (hasPoll ? 'poll' : (hasImages ? 'image' : 'text')),
        linkPreview: req.body.linkPreview,
        poll: req.body.poll,
        visibility: req.body.visibility,
        hashtags: req.body.hashtags,
        school: req.body.school || req.user.school
      };
      
      const post = await postService.createPost(userId, postData);
      
      // Send push notifications to mentioned users
      if (post.mentions && post.mentions.length > 0) {
        const author = await Account.findById(userId).select('firstName lastName');
        const authorName = `${author?.firstName || ''} ${author?.lastName || ''}`.trim() || 'Someone';
        
        const mentionedUsers = await Account.find({
          _id: { $in: post.mentions }
        }).select('_id expoPushToken firstName');
        
        for (const mentionedUser of mentionedUsers) {
          if (mentionedUser._id.toString() !== userId.toString()) {
            // Create in-app notification
            const notification = await createNotification({
              recipient: mentionedUser._id,
              sender: userId,
              type: 'mention_post',
              post: post._id,
              message: `${authorName} mentioned you in a post`
            });
            
            // Emit socket event for real-time notification
            if (req.io && notification) {
              req.io.to(mentionedUser._id.toString()).emit('notification:new', notification);
            }
            
            // Send push notification
            if (mentionedUser.expoPushToken) {
              await sendPushNotification(
                mentionedUser.expoPushToken,
                'You were mentioned!',
                `${authorName} mentioned you in a post`,
                {
                  type: 'mention',
                  postId: post._id.toString(),
                  authorId: userId.toString()
                },
                'mentions'
              );
            }
          }
        }
      }
      
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
      
      // Notify post author about the like (if not self)
      const postAuthorId = post.author?._id || post.author;
      if (postAuthorId && postAuthorId.toString() !== userId.toString()) {
        const liker = await Account.findById(userId).select('firstName lastName');
        const likerName = `${liker?.firstName || ''} ${liker?.lastName || ''}`.trim() || 'Someone';
        
        const postAuthor = await Account.findById(postAuthorId).select('_id expoPushToken');
        
        if (postAuthor) {
          const notification = await createNotification({
            recipient: postAuthor._id,
            sender: userId,
            type: 'like_post',
            post: postId,
            message: `${likerName} liked your post`
          });
          
          if (req.io && notification) {
            req.io.to(postAuthor._id.toString()).emit('notification:new', notification);
          }
          
          if (postAuthor.expoPushToken) {
            await sendPushNotification(
              postAuthor.expoPushToken,
              'New like!',
              `${likerName} liked your post`,
              { type: 'like_post', postId },
              'posts'
            );
          }
        }
      }
      
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
      
      const commenter = await Account.findById(userId).select('firstName lastName');
      const commenterName = `${commenter?.firstName || ''} ${commenter?.lastName || ''}`.trim() || 'Someone';
      const latestComment = post.comments[post.comments.length - 1];
      
      // Notify post author about new comment (if not self)
      if (post.author && post.author._id && post.author._id.toString() !== userId.toString()) {
        const postAuthor = await Account.findById(post.author._id).select('_id expoPushToken');
        
        if (postAuthor) {
          const notification = await createNotification({
            recipient: postAuthor._id,
            sender: userId,
            type: 'comment',
            post: postId,
            comment: latestComment?._id,
            message: `${commenterName} commented on your post`
          });
          
          if (req.io && notification) {
            req.io.to(postAuthor._id.toString()).emit('notification:new', notification);
          }
          
          if (postAuthor.expoPushToken) {
            await sendPushNotification(
              postAuthor.expoPushToken,
              'New comment!',
              `${commenterName} commented on your post`,
              { type: 'comment', postId },
              'posts'
            );
          }
        }
      }
      
      // Extract and notify mentioned users in comment
      const mentionedUserIds = await postService.extractMentions(text);
      if (mentionedUserIds.length > 0) {
        const mentionedUsers = await Account.find({
          _id: { $in: mentionedUserIds }
        }).select('_id expoPushToken');
        
        for (const mentionedUser of mentionedUsers) {
          if (mentionedUser._id.toString() !== userId.toString()) {
            // Create in-app notification
            const notification = await createNotification({
              recipient: mentionedUser._id,
              sender: userId,
              type: 'mention_comment',
              post: postId,
              comment: latestComment?._id,
              message: `${commenterName} mentioned you in a comment`
            });
            
            // Emit socket event for real-time notification
            if (req.io && notification) {
              req.io.to(mentionedUser._id.toString()).emit('notification:new', notification);
            }
            
            // Send push notification
            if (mentionedUser.expoPushToken) {
              await sendPushNotification(
                mentionedUser.expoPushToken,
                'You were mentioned!',
                `${commenterName} mentioned you in a comment`,
                {
                  type: 'mention',
                  postId: postId,
                  commenterId: userId.toString()
                },
                'mentions'
              );
            }
          }
        }
      }
      
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
      
      // Find the comment and notify its author
      const comment = post.comments.find(c => c._id.toString() === commentId);
      if (comment && comment.userId && comment.userId.toString() !== userId.toString()) {
        const liker = await Account.findById(userId).select('firstName lastName');
        const likerName = `${liker?.firstName || ''} ${liker?.lastName || ''}`.trim() || 'Someone';
        
        const commentOwner = await Account.findById(comment.userId).select('_id expoPushToken');
        
        if (commentOwner) {
          const notification = await createNotification({
            recipient: commentOwner._id,
            sender: userId,
            type: 'like_comment',
            post: postId,
            comment: commentId,
            message: `${likerName} liked your comment`
          });
          
          if (req.io && notification) {
            req.io.to(commentOwner._id.toString()).emit('notification:new', notification);
          }
          
          if (commentOwner.expoPushToken) {
            await sendPushNotification(
              commentOwner.expoPushToken,
              'Your comment was liked!',
              `${likerName} liked your comment`,
              { type: 'like_comment', postId, commentId },
              'posts'
            );
          }
        }
      }
      
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
   * Reply to a comment
   * POST /posts/:postId/comments/:commentId/reply
   */
  async replyToComment(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId, commentId } = req.params;
      const { text } = req.body;
      
      if (!text || text.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Reply text is required'
        });
      }
      
      const post = await postService.replyToComment(postId, commentId, userId, text);
      
      const replier = await Account.findById(userId).select('firstName lastName');
      const replierName = `${replier?.firstName || ''} ${replier?.lastName || ''}`.trim() || 'Someone';
      
      // Get the comment with replies
      const originalComment = post.comments.find(c => c._id.toString() === commentId);
      const newReplyIndex = originalComment?.replies ? originalComment.replies.length - 1 : 0;
      
      // Collect all thread participants to notify (excluding self)
      const participantsToNotify = new Set();
      
      // Add comment author
      if (originalComment && originalComment.userId) {
        const commentOwnerId = originalComment.userId._id?.toString() || originalComment.userId.toString();
        if (commentOwnerId !== userId.toString()) {
          participantsToNotify.add(commentOwnerId);
        }
      }
      
      // Add all previous repliers in the thread
      if (originalComment?.replies && originalComment.replies.length > 0) {
        for (const reply of originalComment.replies.slice(0, -1)) { // exclude the new reply
          if (reply.userId) {
            const replyUserId = reply.userId._id?.toString() || reply.userId.toString();
            if (replyUserId !== userId.toString()) {
              participantsToNotify.add(replyUserId);
            }
          }
        }
      }
      
      // Notify comment author specifically
      if (originalComment && originalComment.userId) {
        const commentOwnerId = originalComment.userId._id?.toString() || originalComment.userId.toString();
        if (commentOwnerId !== userId.toString()) {
          const commentOwner = await Account.findById(commentOwnerId).select('_id expoPushToken');
          
          if (commentOwner) {
            const notification = await createNotification({
              recipient: commentOwner._id,
              sender: userId,
              type: 'reply_comment',
              post: postId,
              comment: commentId,
              replyIndex: newReplyIndex,
              message: `${replierName} replied to your comment`
            });
            
            if (req.io && notification) {
              req.io.to(commentOwner._id.toString()).emit('notification:new', notification);
            }
            
            if (commentOwner.expoPushToken) {
              await sendPushNotification(
                commentOwner.expoPushToken,
                'New reply!',
                `${replierName} replied to your comment`,
                { type: 'reply', postId, commentId },
                'mentions'
              );
            }
          }
          
          // Remove from set so we don't send duplicate
          participantsToNotify.delete(commentOwnerId);
        }
      }
      
      // Notify other thread participants
      for (const participantId of participantsToNotify) {
        const participant = await Account.findById(participantId).select('_id expoPushToken');
        
        if (participant) {
          const notification = await createNotification({
            recipient: participant._id,
            sender: userId,
            type: 'reply_thread',
            post: postId,
            comment: commentId,
            replyIndex: newReplyIndex,
            message: `${replierName} also replied to a thread you're in`
          });
          
          if (req.io && notification) {
            req.io.to(participant._id.toString()).emit('notification:new', notification);
          }
          
          if (participant.expoPushToken) {
            await sendPushNotification(
              participant.expoPushToken,
              'New reply in thread',
              `${replierName} also replied to a thread you're in`,
              { type: 'reply_thread', postId, commentId },
              'mentions'
            );
          }
        }
      }
      
      // Handle @ mentions in the reply
      const mentionedUserIds = await postService.extractMentions(text);
      if (mentionedUserIds.length > 0) {
        const mentionedUsers = await Account.find({
          _id: { $in: mentionedUserIds }
        }).select('_id expoPushToken');
        
        for (const mentionedUser of mentionedUsers) {
          if (mentionedUser._id.toString() !== userId.toString()) {
            const notification = await createNotification({
              recipient: mentionedUser._id,
              sender: userId,
              type: 'mention_reply',
              post: postId,
              comment: commentId,
              replyIndex: newReplyIndex,
              message: `${replierName} mentioned you in a reply`
            });
            
            if (req.io && notification) {
              req.io.to(mentionedUser._id.toString()).emit('notification:new', notification);
            }
            
            if (mentionedUser.expoPushToken) {
              await sendPushNotification(
                mentionedUser.expoPushToken,
                'You were mentioned!',
                `${replierName} mentioned you in a reply`,
                { type: 'mention_reply', postId, commentId },
                'mentions'
              );
            }
          }
        }
      }
      
      // Emit socket event
      if (req.io) {
        req.io.emit('comment:replied', { postId, commentId, userId, post });
      }
      
      res.status(201).json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Reply to comment error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * Like a reply
   * POST /posts/:postId/comments/:commentId/replies/:replyIndex/like
   */
  async likeReply(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId, commentId, replyIndex } = req.params;
      
      const post = await postService.likeReply(postId, commentId, parseInt(replyIndex), userId);
      
      // Find the reply and notify its author
      const comment = post.comments.find(c => c._id.toString() === commentId);
      const reply = comment?.replies?.[parseInt(replyIndex)];
      
      if (reply && reply.userId) {
        const replyOwnerId = reply.userId._id?.toString() || reply.userId.toString();
        
        if (replyOwnerId !== userId.toString()) {
          const liker = await Account.findById(userId).select('firstName lastName');
          const likerName = `${liker?.firstName || ''} ${liker?.lastName || ''}`.trim() || 'Someone';
          
          const replyOwner = await Account.findById(replyOwnerId).select('_id expoPushToken');
          
          if (replyOwner) {
            const notification = await createNotification({
              recipient: replyOwner._id,
              sender: userId,
              type: 'like_reply',
              post: postId,
              comment: commentId,
              replyIndex: parseInt(replyIndex),
              message: `${likerName} liked your reply`
            });
            
            if (req.io && notification) {
              req.io.to(replyOwner._id.toString()).emit('notification:new', notification);
            }
            
            if (replyOwner.expoPushToken) {
              await sendPushNotification(
                replyOwner.expoPushToken,
                'Your reply was liked!',
                `${likerName} liked your reply`,
                { type: 'like_reply', postId, commentId, replyIndex: parseInt(replyIndex) },
                'posts'
              );
            }
          }
        }
      }
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Like reply error:', error);
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
      const { content = '', visibility = 'public' } = req.body;
      
      // Get original post to notify its author
      const originalPost = await postService.getPostById(postId);
      
      const repost = await postService.sharePost(postId, userId, content, visibility);
      
      // Notify original post author about the share/repost (if not self)
      const originalAuthorId = originalPost?.author?._id || originalPost?.author;
      if (originalAuthorId && originalAuthorId.toString() !== userId.toString()) {
        const sharer = await Account.findById(userId).select('firstName lastName');
        const sharerName = `${sharer?.firstName || ''} ${sharer?.lastName || ''}`.trim() || 'Someone';
        
        const originalAuthor = await Account.findById(originalAuthorId).select('_id expoPushToken');
        
        if (originalAuthor) {
          const notification = await createNotification({
            recipient: originalAuthor._id,
            sender: userId,
            type: 'share',
            post: postId,
            message: `${sharerName} reposted your post`
          });
          
          if (req.io && notification) {
            req.io.to(originalAuthor._id.toString()).emit('notification:new', notification);
          }
          
          if (originalAuthor.expoPushToken) {
            await sendPushNotification(
              originalAuthor.expoPushToken,
              'Your post was shared!',
              `${sharerName} reposted your post`,
              { type: 'share', postId },
              'posts'
            );
          }
        }
      }
      
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
   * Share post to specific connections (direct share with push notifications)
   * POST /posts/:postId/share/connections
   */
  async shareToConnections(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { postId } = req.params;
      const { connectionIds, message = '' } = req.body;
      
      if (!connectionIds || !Array.isArray(connectionIds) || connectionIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Please select at least one connection to share with'
        });
      }
      
      // Get the post
      const post = await postService.getById(postId, userId);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      // Get sender info
      const sender = await Account.findById(userId).select('firstName lastName profileImage');
      if (!sender) {
        return res.status(404).json({
          success: false,
          error: 'Sender not found'
        });
      }
      
      const senderName = `${sender.firstName} ${sender.lastName}`;
      
      // Get connections with their push tokens
      const connections = await Account.find({
        _id: { $in: connectionIds }
      }).select('firstName lastName expoPushToken');
      
      if (connections.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No valid connections found'
        });
      }
      
      // Send push notifications to all selected connections
      const notificationPromises = connections.map(async (connection) => {
        if (connection.expoPushToken) {
          const postPreview = post.content 
            ? (post.content.length > 50 ? post.content.substring(0, 50) + '...' : post.content)
            : 'Shared a post';
          
          await sendPushNotification(
            connection.expoPushToken,
            `${senderName} shared a post with you`,
            message || postPreview,
            {
              type: 'post_share',
              postId: postId,
              senderId: userId.toString(),
              senderName: senderName,
              message: message
            }
          );
        }
        return connection._id;
      });
      
      await Promise.all(notificationPromises);
      
      // Emit socket events for real-time updates
      if (req.io) {
        connectionIds.forEach(connId => {
          req.io.to(connId.toString()).emit('post:shared_with_you', {
            postId,
            senderId: userId,
            senderName,
            post,
            message
          });
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Post shared with ${connections.length} connection${connections.length > 1 ? 's' : ''}`,
        sharedWith: connections.map(c => ({
          id: c._id,
          name: `${c.firstName} ${c.lastName}`
        }))
      });
    } catch (error) {
      console.error('Share to connections error:', error);
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
