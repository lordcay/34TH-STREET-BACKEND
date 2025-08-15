const messageService = require('./message.service');
const db = require('_helpers/db');


module.exports = {
  sendMessage,
  getMessages,
  getConversations
};

async function sendMessage(req, res, next) {
  try {
    const senderId = req.user.id;
    const { recipientId, message } = req.body;

    const created = await messageService.create({ senderId, recipientId, message });

    // ✅ Emit notification to recipient via Socket.IO
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const recipientSocketId = connectedUsers[recipientId];

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('newMessage', {
        message: created,
        sender: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
          photos: req.user.photos || [], // optional, if you want to show profile photo
        }
      });
    }

    res.json(created);
  } catch (err) {
    next(err);
  }
}








async function getMessages(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    const messages = await messageService.getMessagesBetweenUsers(currentUserId, otherUserId);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

async function getConversations(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const conversations = await messageService.getUserConversations(currentUserId);
    res.json(conversations);
  } catch (err) {
    next(err);
  }
}



// const db = require('_helpers/db');

// async function sendMessage(req, res, next) {
//   try {
//     const senderId = req.user.id;
//     const { recipientId, message } = req.body;

//     const created = await db.Message.create({
//       senderId,
//       recipientId,
//       message,
//       timestamp: new Date(),
//       read: false
//     });

//     const io = req.app.get('io');
//     const connectedUsers = req.app.get('connectedUsers');
//     const recipientSocketId = connectedUsers[recipientId];

//     if (recipientSocketId) {
//       io.to(recipientSocketId).emit('newMessage', {
//         message: created,
//         sender: {
//           id: req.user.id,
//           firstName: req.user.firstName,
//           lastName: req.user.lastName,
//           email: req.user.email,
//           photos: req.user.photos || [],
//         }
//       });
//     }

//     const recipient = await db.Account.findById(recipientId);
//     if (recipient && recipient.expoPushToken) {
//       await fetch('https://exp.host/--/api/v2/push/send', {
//         method: 'POST',
//         headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           to: recipient.expoPushToken,
//           sound: 'default',
//           title: '📩 New Message',
//           body: message,
//           data: { senderId, recipientId },
//         }),
//       });
//       console.log('✅ Expo push sent');
//     } else {
//       console.log('ℹ️ No Expo token found for recipient.');
//     }

//     res.json(created);
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = {
//   sendMessage,
// };
