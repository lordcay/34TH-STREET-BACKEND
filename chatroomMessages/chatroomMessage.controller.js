


// chatroomMessage.controller.js
const chatroomMessageService = require('./chatroomMessage.service');
const containsObjectionableContent = require('../utils/filterObjectionableContent');
const Block = require('../blockUser/block.model'); // ✅ import the Block model



async function sendMessage(req, res, next) {
    try {
        const { chatroomId, message, media, replyTo, avatarUrl, senderName } = req.body;
        const senderId = req.user.id;

        // 🚫 Check for objectionable content
        if (message && containsObjectionableContent(message)) {
            return res.status(400).json({ message: 'Message contains inappropriate content' });
        }

        

        const newMessage = await chatroomMessageService.createMessage({
            chatroomId,
            senderId,
            message,
            media,
            avatarUrl,
            senderName,
            replyTo: replyTo || null
        });

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

module.exports = {
    sendMessage,
    fetchMessages,
};
