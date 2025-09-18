

// // message.controller.js
// const messageService = require('./message.service');
// const db = require('_helpers/db');
// const { sendExpoPush } = require('./utils/push'); // ← add this import


// module.exports = {
//   sendMessage,
//   getMessages,
//   getConversations
// };

// function makePairKey(a, b) {
//   const [x, y] = [String(a), String(b)].sort();
//   return `dm:${x}_${y}`;
// }

// async function sendMessage(req, res, next) {
//   try {
//     const senderId = req.user.id;
//     const { recipientId, message } = req.body;

//     // 1) Persist
//     const created = await messageService.create({ senderId, recipientId, message });

//     // 2) Derive senderName + preview (safe fallbacks)
//     const senderName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim() || 'Someone';
//     const preview = (message || '').toString().slice(0, 80);

//     // 3) Wire up socket
//     const io = req.app.get('io');
//     const connectedUsers = req.app.get('connectedUsers');

//     // ✅ A) Direct-to-socket (only the recipient hears/gets it)
//     const recipientSocketId = connectedUsers?.[recipientId];
//     if (recipientSocketId) {
//       io.to(recipientSocketId).emit('newMessage', {
//         // keep old shape, but include meta so your toast has data
//         message: created,
//         meta: {
//           kind: 'dm',
//           senderId,
//           senderName,
//           preview,
//         }
//       });
// const room = makePairKey(senderId, recipientId);

// // let the chat list update its lastMessage/ts and bump unread for the recipient
// io.to(room).emit('conversation:update', {
//   peerA: senderId,
//   peerB: recipientId,
//   lastMessage: preview,
//   timestamp: created.timestamp || Date.now(),
//   unreadBumpFor: recipientId
// });

//     }
// try {
//       const recipient = await db.Account.findById(recipientId).lean().exec();
//       const recipientPushToken = recipient?.expoPushToken || recipient?.pushToken; // adjust to your schema
//       if (recipientPushToken) {
//         await sendExpoPush({
//           to: recipientPushToken,
//           sound: 'default',
//           title: `New message from ${senderName}`,
//           body: preview,
//           data: {
//             kind: 'dm',
//             senderId,
//             senderName,
//             otherUserId: senderId,
//             preview,
//           },
//         });
//       }
//     } catch (e) {
//       console.error('Failed to send Expo push:', e?.message || e);
//     }
   

//     // 4) Respond
//     res.json(created);
//   } catch (err) {
//     next(err);
//   }
// }

// async function getMessages(req, res, next) {
//   try {
//     const currentUserId = req.user.id;
//     const otherUserId = req.params.userId;
//     const messages = await messageService.getMessagesBetweenUsers(currentUserId, otherUserId);

//     // It's fine to keep read receipt room emits here
//     const io = req.app.get('io');
//     const room = `dm:${[String(currentUserId), String(otherUserId)].sort().join('_')}`;
//     io.to(room).emit('message:read', { readerId: currentUserId, otherId: otherUserId });
//     io.to(room).emit('conversation:update', {
//       peerA: currentUserId,
//       peerB: otherUserId,
//       unreadResetFor: currentUserId
//     });

//     res.json(messages);
//   } catch (err) {
//     next(err);
//   }
// }

// async function getConversations(req, res, next) {
//   try {
//     const currentUserId = req.user.id;
//     const conversations = await messageService.getUserConversations(currentUserId);
//     res.json(conversations);
//   } catch (err) {
//     next(err);
//   }
// }


// messages/message.controller.js
const messageService = require('./message.service');
const db = require('_helpers/db');
const { sendExpoPush } = require('./utils/push');

module.exports = {
  sendMessage,
  getMessages,
  getConversations,
};

function makePairKey(a, b) {
  const [x, y] = [String(a), String(b)].sort();
  return `dm:${x}_${y}`;
}

async function sendMessage(req, res, next) {
  try {
    const senderId = req.user.id;
    const { recipientId, message } = req.body;

    // 1) Persist
    const created = await messageService.create({ senderId, recipientId, message });

    // 1b) Ensure consistent populated payload (keeps client shape uniform)
    const saved =
      (messageService.findByIdPopulated
        ? await messageService.findByIdPopulated(created._id)
        : null) || created;

    // 2) Derive meta
    const senderName =
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim() || 'Someone';
    const preview = (message || '').toString().slice(0, 80);

    // 3) Sockets
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const room = makePairKey(senderId, recipientId);

    // A) Direct notify recipient
    const recipientSocketId = connectedUsers?.[recipientId];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('newMessage', {
        message: saved, // populated for consistent client shape
        meta: {
          kind: 'dm',
          senderId: String(senderId),
          senderName,
          preview,
        },
      });

      // Bump conversation row in the DM room
       const senderSocketId    = connectedUsers?.[senderId];
    const payload = {
      peerA: String(senderId),
      peerB: String(recipientId),
      lastMessage: preview,
      timestamp: saved?.timestamp || Date.now(),
      unreadBumpFor: String(recipientId), // recipient gets 1
    };
    if (senderSocketId)    io.to(senderSocketId).emit('conversation:update', payload);
    if (recipientSocketId) io.to(recipientSocketId).emit('conversation:update', payload);
      // io.to(room).emit('conversation:update', {
      //   peerA: String(senderId),
      //   peerB: String(recipientId),
      //   lastMessage: preview,
      //   timestamp: saved?.timestamp || Date.now(), // keep your 'timestamp' field
      //   unreadBumpFor: String(recipientId),
      // });
    }

    // 4) Push notification (best effort)
    try {
      const recipient = await db.Account.findById(recipientId).lean().exec();
      const recipientPushToken = recipient?.expoPushToken || recipient?.pushToken;
      if (recipientPushToken) {
        await sendExpoPush({
          to: recipientPushToken,
          sound: 'default',
          title: `New message from ${senderName}`,
          body: preview,
          data: {
            kind: 'dm',
            senderId: String(senderId),
            senderName,
            otherUserId: String(senderId),
            preview,
          },
        });
      }
    } catch (e) {
      console.error('Failed to send Expo push:', e?.message || e);
    }

    // 5) Respond
    res.json(saved);
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    // Return populated messages for consistent client shape
    const messages = await messageService.getMessagesBetweenUsers(currentUserId, otherUserId);

    // Read + conversation updates for this DM room
    const io = req.app.get('io');
    const room = makePairKey(currentUserId, otherUserId);

    io.to(room).emit('message:read', {
      readerId: String(currentUserId),
      otherId: String(otherUserId),
    });

    io.to(room).emit('conversation:update', {
      peerA: String(currentUserId),
      peerB: String(otherUserId),
      unreadResetFor: String(currentUserId),
    });

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
