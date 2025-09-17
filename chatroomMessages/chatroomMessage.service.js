

// chatroomMessage.service.js
const ChatroomMessage = require('./chatroomMessage.model');

async function createMessage({ chatroomId, senderId, message, media, avatarUrl, senderName, replyTo }) {
    const created = await ChatroomMessage.create({
        chatroomId,
        senderId,
        message,
        media,
        avatarUrl,
        senderName,
        replyTo: replyTo || null,
    });

    // Return populated message so frontend and socket listeners receive the same shape
    return ChatroomMessage.findById(created._id)
        .populate('senderId', '_id firstName lastName photos')
        .populate('replyTo.senderId', '_id firstName lastName photos');
}

async function getMessagesByChatroom(chatroomId) {
    return ChatroomMessage.find({ chatroomId })
        .populate('senderId', '_id firstName lastName photos')
        .populate('replyTo.senderId', '_id firstName lastName photos')
        .sort({ createdAt: 1 });
}

async function markAsRead(messageId, userId) {
    return ChatroomMessage.findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: userId } },
        { new: true }
    );
}

module.exports = {
    createMessage,
    getMessagesByChatroom,
    markAsRead,
};


// // chatroomMessage.service.js
// const ChatroomMessage = require('./chatroomMessage.model');

// async function createMessage({ chatroomId, senderId, message, media, avatarUrl, senderName, replyTo }) {
//     const created = await ChatroomMessage.create({
//         chatroomId,
//         senderId,
//         message,
//         media,
//         avatarUrl,
//         senderName,
//         replyTo: replyTo || null,
//     });

//     // Return populated message so frontend and socket listeners receive the same shape
//     return ChatroomMessage.findById(created._id)
//         .populate('senderId', '_id firstName lastName photos')
//         .populate('replyTo.senderId', '_id firstName lastName photos');
// }

// async function getMessagesByChatroom(chatroomId) {
//     return ChatroomMessage.find({ chatroomId })
//         .populate('senderId', '_id firstName lastName photos')
//         .populate('replyTo.senderId', '_id firstName lastName photos')
//         .sort({ createdAt: 1 });
// }

// async function markAsRead(messageId, userId) {
//     return ChatroomMessage.findByIdAndUpdate(
//         messageId,
//         { $addToSet: { readBy: userId } },
//         { new: true }
//     );
// }

// module.exports = {
//     createMessage,
//     getMessagesByChatroom,
//     markAsRead,
// };
