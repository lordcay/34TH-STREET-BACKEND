// const messageService = require('./message.service');
// const db = require('_helpers/db');


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

//     // A) Direct-to-socket (legacy) — used anywhere in app
//     const recipientSocketId = connectedUsers?.[recipientId];
//     if (recipientSocketId) {
//       io.to(recipientSocketId).emit('newMessage', {
//         // keep old shape, but include name + preview so your toast has data
//         message: created,
//         meta: {
//           kind: 'dm',
//           senderId,
//           senderName,
//           preview,
//         }
//       });
//     }

//     // B) Room broadcast (preferred in PrivateChatScreen)
//     // Include senderName inline so receivers don't see "undefined"
//     const room = makePairKey(senderId, recipientId);
//     const payloadForRoom = {
//       ...(created.toObject ? created.toObject() : created),
//       senderName,
//     };
//     io.to(room).emit('message:new', payloadForRoom);

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
//     const io = req.app.get('io');
//     const room = `dm:${[String(currentUserId), String(otherUserId)].sort().join('_')}`;
//     io.to(room).emit('message:read', { readerId: currentUserId, otherId: otherUserId });
//     io.to(room).emit('conversation:update', {
//   peerA: currentUserId,
//   peerB: otherUserId,
//   unreadResetFor: currentUserId
// });

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


// message.controller.js
const messageService = require('./message.service');
const db = require('_helpers/db');
const { sendExpoPush } = require('./utils/push'); // ← add this import


module.exports = {
  sendMessage,
  getMessages,
  getConversations
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

    // 2) Derive senderName + preview (safe fallbacks)
    const senderName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim() || 'Someone';
    const preview = (message || '').toString().slice(0, 80);

    // 3) Wire up socket
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');

    // ✅ A) Direct-to-socket (only the recipient hears/gets it)
    const recipientSocketId = connectedUsers?.[recipientId];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('newMessage', {
        // keep old shape, but include meta so your toast has data
        message: created,
        meta: {
          kind: 'dm',
          senderId,
          senderName,
          preview,
        }
      });
    }
try {
      const recipient = await db.Account.findById(recipientId).lean().exec();
      const recipientPushToken = recipient?.expoPushToken || recipient?.pushToken; // adjust to your schema
      if (recipientPushToken) {
        await sendExpoPush({
          to: recipientPushToken,
          sound: 'default',
          title: `New message from ${senderName}`,
          body: preview,
          data: {
            kind: 'dm',
            senderId,
            senderName,
            otherUserId: senderId,
            preview,
          },
        });
      }
    } catch (e) {
      console.error('Failed to send Expo push:', e?.message || e);
    }
   

    // 4) Respond
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

    // It's fine to keep read receipt room emits here
    const io = req.app.get('io');
    const room = `dm:${[String(currentUserId), String(otherUserId)].sort().join('_')}`;
    io.to(room).emit('message:read', { readerId: currentUserId, otherId: otherUserId });
    io.to(room).emit('conversation:update', {
      peerA: currentUserId,
      peerB: otherUserId,
      unreadResetFor: currentUserId
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
