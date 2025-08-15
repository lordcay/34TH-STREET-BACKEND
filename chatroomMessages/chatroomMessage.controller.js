// const chatroomMessageService = require('./chatroomMessage.service');

// async function sendMessage(req, res, next) {
//     try {
//         const { chatroomId, message, media, replyTo } = req.body;
//         const senderId = req.user.id;
//         const newMessage = await chatroomMessageService.createMessage({
//             chatroomId,
//             senderId,
//             message,
//             media,
//             replyTo: replyTo || null // persist replyTo

//         });
//         res.json(newMessage);
//     } catch (err) {
//         next(err);
//     }
// }

// // chatroomMessage.controller.js
// async function fetchMessages(req, res, next) {
//     try {
//         const chatroomId = req.params.chatroomId;
//         const messages = await chatroomMessageService.getMessagesByChatroom(chatroomId);

//         // Map to include senderName and avatarUrl for frontend
//         const messagesWithSender = messages.map(m => ({
//             ...m.toObject(),
//             senderName: m.senderId?.firstName || 'Unknown',
//             avatarUrl: m.senderId?.photos?.[0]
//                 ? (m.senderId.photos[0].startsWith('http')
//                     ? m.senderId.photos[0]
//                     : `${process.env.BASE_URL}${m.senderId.photos[0]}`)
//                 : null
//         }));

//         res.json(messagesWithSender);
//     } catch (err) {
//         next(err);
//     }
// }


// module.exports = {
//     sendMessage,
//     fetchMessages,
// };



// chatroomMessage.controller.js
const chatroomMessageService = require('./chatroomMessage.service');

async function sendMessage(req, res, next) {
    try {
        const { chatroomId, message, media, replyTo, avatarUrl, senderName } = req.body;
        const senderId = req.user.id;

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
