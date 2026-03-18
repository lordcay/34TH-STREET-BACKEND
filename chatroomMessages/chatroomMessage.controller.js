


// chatroomMessage.controller.js
const chatroomMessageService = require('./chatroomMessage.service');
const containsObjectionableContent = require('../utils/filterObjectionableContent');
const Block = require('../blockUser/block.model'); // ✅ import the Block model
const ChatroomMessage = require('./chatroomMessage.model');
const Chatroom = require('../chatroom/chatroom.model');
const Account = require('../accounts/account.model');
const { createNotification } = require('../notifications/notification.controller');

// Helper to extract mentioned user IDs from message text
// Format: @firstName_lastName or @firstName
async function extractMentionedUsers(messageText) {
    if (!messageText) return [];
    
    // Match @firstName_lastName pattern
    const mentionPattern = /@(\w+)(?:_(\w+))?/g;
    const mentions = [];
    let match;
    
    while ((match = mentionPattern.exec(messageText)) !== null) {
        const firstName = match[1];
        const lastName = match[2] || null;
        
        // Find user by name
        const query = lastName 
            ? { firstName: new RegExp(`^${firstName}$`, 'i'), lastName: new RegExp(`^${lastName}$`, 'i') }
            : { firstName: new RegExp(`^${firstName}$`, 'i') };
        
        const user = await Account.findOne(query).select('_id');
        if (user) {
            mentions.push(user._id);
        }
    }
    
    return [...new Set(mentions.map(id => id.toString()))]; // Remove duplicates
}

async function sendMessage(req, res, next) {
    try {
        const { chatroomId, message, media, replyTo, avatarUrl, senderName } = req.body;
        const senderId = req.user.id;

        // 🚫 Check for objectionable content
        if (message && containsObjectionableContent(message)) {
            return res.status(400).json({ message: 'Message contains inappropriate content' });
        }

        // Extract mentioned users
        const mentionedUserIds = await extractMentionedUsers(message);

        const newMessage = await chatroomMessageService.createMessage({
            chatroomId,
            senderId,
            message,
            media,
            avatarUrl,
            senderName,
            replyTo: replyTo || null,
            mentions: mentionedUserIds
        });

        // Get chatroom name for notifications
        const chatroom = await Chatroom.findById(chatroomId).select('name');
        const chatroomName = chatroom?.name || 'a chatroom';

        // Create notifications for mentioned users
        for (const mentionedUserId of mentionedUserIds) {
            if (mentionedUserId !== senderId.toString()) {
                await createNotification({
                    recipient: mentionedUserId,
                    sender: senderId,
                    type: 'chatroom_mention',
                    chatroomMessage: newMessage._id,
                    chatroom: chatroomId,
                    chatroomName,
                    message: `${senderName || 'Someone'} mentioned you in ${chatroomName}`
                });
            }
        }

        // If this is a reply, notify the original message sender
        if (replyTo && replyTo.senderId && replyTo.senderId.toString() !== senderId.toString()) {
            await createNotification({
                recipient: replyTo.senderId,
                sender: senderId,
                type: 'chatroom_reply',
                chatroomMessage: newMessage._id,
                chatroom: chatroomId,
                chatroomName,
                message: `${senderName || 'Someone'} replied to your message in ${chatroomName}`
            });
        }

        // Return the populated message
        res.json(newMessage);
    } catch (err) {
        next(err);
    }
}

async function fetchMessages(req, res, next) {
    try {
        const chatroomId = req.params.chatroomId;
        const messages = await chatroomMessageService.getMessagesByChatroom(chatroomId);

        // Provide convenient top-level fields the frontend expects
        const messagesWithSender = messages.map(m => {
            const obj = m.toObject();
            obj.senderName = obj.senderName || obj.senderId?.firstName || 'Unknown';
            obj.avatarUrl = obj.avatarUrl ||
                (obj.senderId?.photos?.[0]
                    ? (obj.senderId.photos[0].startsWith('http') ? obj.senderId.photos[0] : `${process.env.BASE_URL}${obj.senderId.photos[0]}`)
                    : null);
            return obj;
        });

        res.json(messagesWithSender);
    } catch (err) {
        next(err);
    }
}

// Like/Unlike a message
async function toggleLike(req, res, next) {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        const message = await ChatroomMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const alreadyLiked = message.likes.includes(userId);
        
        if (alreadyLiked) {
            // Unlike
            message.likes.pull(userId);
        } else {
            // Like
            message.likes.push(userId);
            
            // Create notification for message owner (if not self)
            if (message.senderId.toString() !== userId) {
                const chatroom = await Chatroom.findById(message.chatroomId).select('name');
                const sender = await Account.findById(userId).select('firstName lastName');
                const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Someone';
                
                await createNotification({
                    recipient: message.senderId,
                    sender: userId,
                    type: 'chatroom_like',
                    chatroomMessage: message._id,
                    chatroom: message.chatroomId,
                    chatroomName: chatroom?.name || 'a chatroom',
                    message: `${senderName} liked your message in ${chatroom?.name || 'a chatroom'}`
                });
            }
        }

        await message.save();

        res.json({
            success: true,
            liked: !alreadyLiked,
            likeCount: message.likes.length,
            likes: message.likes
        });
    } catch (err) {
        next(err);
    }
}

// Add a nested reply to a message
async function addReply(req, res, next) {
    try {
        const { messageId } = req.params;
        const { message: replyText, avatarUrl, senderName } = req.body;
        const senderId = req.user.id;

        // Check for objectionable content
        if (replyText && containsObjectionableContent(replyText)) {
            return res.status(400).json({ message: 'Reply contains inappropriate content' });
        }

        const parentMessage = await ChatroomMessage.findById(messageId);
        if (!parentMessage) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Extract mentioned users from reply
        const mentionedUserIds = await extractMentionedUsers(replyText);

        const newReply = {
            senderId,
            senderName,
            avatarUrl,
            message: replyText,
            createdAt: new Date(),
            likes: []
        };

        parentMessage.replies.push(newReply);
        await parentMessage.save();

        // Get the saved reply with its _id
        const savedReply = parentMessage.replies[parentMessage.replies.length - 1];

        // Get chatroom name for notifications
        const chatroom = await Chatroom.findById(parentMessage.chatroomId).select('name');
        const chatroomName = chatroom?.name || 'a chatroom';

        // Notify the parent message owner (if not self)
        if (parentMessage.senderId.toString() !== senderId) {
            await createNotification({
                recipient: parentMessage.senderId,
                sender: senderId,
                type: 'chatroom_reply',
                chatroomMessage: parentMessage._id,
                chatroom: parentMessage.chatroomId,
                chatroomName,
                message: `${senderName || 'Someone'} replied to your message in ${chatroomName}`
            });
        }

        // Notify mentioned users
        for (const mentionedUserId of mentionedUserIds) {
            if (mentionedUserId !== senderId) {
                await createNotification({
                    recipient: mentionedUserId,
                    sender: senderId,
                    type: 'chatroom_mention',
                    chatroomMessage: parentMessage._id,
                    chatroom: parentMessage.chatroomId,
                    chatroomName,
                    message: `${senderName || 'Someone'} mentioned you in ${chatroomName}`
                });
            }
        }

        res.json({
            success: true,
            reply: savedReply,
            replyCount: parentMessage.replies.length
        });
    } catch (err) {
        next(err);
    }
}

// Like/Unlike a nested reply
async function toggleReplyLike(req, res, next) {
    try {
        const { messageId, replyId } = req.params;
        const userId = req.user.id;

        const message = await ChatroomMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const reply = message.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ message: 'Reply not found' });
        }

        const alreadyLiked = reply.likes.includes(userId);
        
        if (alreadyLiked) {
            reply.likes.pull(userId);
        } else {
            reply.likes.push(userId);
            
            // Notify reply owner (if not self)
            if (reply.senderId.toString() !== userId) {
                const chatroom = await Chatroom.findById(message.chatroomId).select('name');
                const sender = await Account.findById(userId).select('firstName lastName');
                const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Someone';
                
                await createNotification({
                    recipient: reply.senderId,
                    sender: userId,
                    type: 'chatroom_like',
                    chatroomMessage: message._id,
                    chatroom: message.chatroomId,
                    chatroomName: chatroom?.name || 'a chatroom',
                    message: `${senderName} liked your reply in ${chatroom?.name || 'a chatroom'}`
                });
            }
        }

        await message.save();

        res.json({
            success: true,
            liked: !alreadyLiked,
            likeCount: reply.likes.length
        });
    } catch (err) {
        next(err);
    }
}

// Get replies for a message (paginated)
async function getReplies(req, res, next) {
    try {
        const { messageId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const message = await ChatroomMessage.findById(messageId)
            .populate('replies.senderId', '_id firstName lastName photos');

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedReplies = message.replies.slice(startIndex, endIndex);

        res.json({
            success: true,
            replies: paginatedReplies,
            total: message.replies.length,
            page: parseInt(page),
            hasMore: endIndex < message.replies.length
        });
    } catch (err) {
        next(err);
    }
}

// Delete a message (only by sender)
async function deleteMessage(req, res, next) {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        const message = await ChatroomMessage.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user is the sender
        if (message.senderId.toString() !== userId) {
            return res.status(403).json({ message: 'You can only delete your own messages' });
        }

        // Delete the message
        await ChatroomMessage.findByIdAndDelete(messageId);

        res.json({
            success: true,
            message: 'Message deleted successfully',
            deletedMessageId: messageId,
            chatroomId: message.chatroomId
        });
    } catch (err) {
        console.error('Delete message error:', err);
        next(err);
    }
}

module.exports = {
    sendMessage,
    fetchMessages,
    toggleLike,
    addReply,
    toggleReplyLike,
    getReplies,
    deleteMessage,
};
