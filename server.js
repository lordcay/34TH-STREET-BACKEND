

require('rootpath')();
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const makePairKey = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `dm:${x}_${y}`;
};



const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');
const imageRoutes = require('./uploads/image.controller');
const db = require('./_helpers/db');
const Message = db.Message;
const ChatroomMessage = require('./chatroomMessages/chatroomMessage.model');
const chatroomMessageRoutes = require('./chatroomMessages/chatroomMessage.routes');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// Routes
app.use('/accounts', require('./accounts/accounts.controller'));
app.use('/messages', require('./messages/messages.routes'));
app.use('/chatrooms', require('./chatroom/chatroom.controller'));
app.use('/uploads', express.static('public/uploads'));
app.use('/uploads', express.static('uploads'));
app.use('/api', imageRoutes);
app.use('/api-docs', require('_helpers/swagger'));
app.use('/api/chatroom-messages', chatroomMessageRoutes);
app.use(errorHandler);

// ✅ In-memory store for connected users
const connectedUsers = {};

io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    // Register user
    socket.on('register', (userId) => {
        connectedUsers[userId] = socket.id;
        console.log(`✅ Registered user ${userId} to socket ${socket.id}`);
    });

    // Join chatroom
    socket.on('joinChatroom', ({ chatroomId, userId }) => {
        socket.join(chatroomId);
        console.log(`👥 User ${userId} joined chatroom ${chatroomId}`);
        io.to(chatroomId).emit('userJoined', { userId });
    });

    // Leave chatroom
    socket.on('leaveChatroom', ({ chatroomId, userId }) => {
        socket.leave(chatroomId);
        console.log(`👤 User ${userId} left chatroom ${chatroomId}`);
        io.to(chatroomId).emit('userLeft', { userId });
    });

    // Send chatroom message (save and broadcast)
    socket.on('sendChatroomMessage', async ({ chatroomId, senderId, message, media, senderName, avatarUrl }) => {
  try {
    const newMessage = await ChatroomMessage.create({
      chatroomId, senderId, message, media, readBy: [senderId], senderName, avatarUrl
    });

    const payload = {
      ...newMessage.toObject(),
      senderName: senderName || 'Someone'
    };

    io.to(chatroomId).emit('newChatroomMessage', payload);

    // (optional) also notify room members individually via push — handled below in section C
  } catch (err) {
    console.error('❌ Error sending chatroom message:', err);
  }
});

    // socket.on('sendChatroomMessage', async ({ chatroomId, senderId, message, media, senderName, avatarUrl }) => {
    //     try {
    //         const newMessage = await ChatroomMessage.create({
    //             chatroomId,
    //             senderId,
    //             message,
    //             media,
    //             readBy: [senderId],
    //             senderName,
    //             avatarUrl
    //         });

    //         io.to(chatroomId).emit('newChatroomMessage', newMessage);
    //         console.log(`💬 Message sent to chatroom ${chatroomId}`);
    //     } catch (err) {
    //         console.error('❌ Error sending chatroom message:', err);
    //     }
    // });

    // Typing indicators
// Typing indicators
socket.on('typing', ({ chatroomId, userId, senderName }) => {
  socket.to(chatroomId).emit('userTyping', { userId, senderName });  // ✅ forward name
});

socket.on('stopTyping', ({ chatroomId, userId, senderName }) => {
  socket.to(chatroomId).emit('userStoppedTyping', { userId, senderName }); // ✅ forward name
});


    // socket.on('typing', ({ chatroomId, userId }) => {
    //     socket.to(chatroomId).emit('userTyping', { userId });
    // });

    // socket.on('stopTyping', ({ chatroomId, userId }) => {
    //     socket.to(chatroomId).emit('userStoppedTyping', { userId });
    // });

    // Read receipts (for private chats)

    socket.on('readMessages', async ({ readerId, senderId }) => {
  try {
    await Message.updateMany(
      { senderId, recipientId: readerId, read: false },
      { $set: { read: true } }
    );

    const room = makePairKey(readerId, senderId);

    // ✅ Tell both sides that messages were read (so sender can flip ticks)
    io.to(room).emit('message:read', { readerId, otherId: senderId });

    // ✅ Also patch chat-list rows to reflect unread = 0 for the reader
    io.to(room).emit('conversation:update', {
      peerA: readerId,
      peerB: senderId,
      unreadResetFor: readerId
    });
  } catch (error) {
    console.error('❌ Failed to mark messages as read:', error);
  }
});

    // socket.on('readMessages', async ({ readerId, senderId }) => {
    //     try {
    //         await Message.updateMany(
    //             { senderId, recipientId: readerId, read: false },
    //             { $set: { read: true } }
    //         );

    //         const senderSocketId = connectedUsers[senderId];
    //         if (senderSocketId) {
    //             io.to(senderSocketId).emit('messagesRead', { from: readerId });
    //             console.log(`📬 Read receipt sent to user ${senderId}`);
    //         }
    //     } catch (error) {
    //         console.error('❌ Failed to mark messages as read:', error);
    //     }
    // });

    socket.on('disconnect', () => {
        console.log('🔴 Socket disconnected:', socket.id);
        for (const userId in connectedUsers) {
            if (connectedUsers[userId] === socket.id) {
                delete connectedUsers[userId];
                break;
            }
        }
    });

    // ✅ DM: join/leave a 1:1 conversation room
socket.on('dm:join', ({ meId, otherUserId }) => {
  const room = makePairKey(meId, otherUserId);
  socket.join(room);
  // optional: console.log(`DM join ${room}`);
});

socket.on('dm:leave', ({ meId, otherUserId }) => {
  const room = makePairKey(meId, otherUserId);
  socket.leave(room);
});

// ✅ DM typing indicators (relay to the other peer in the same DM room)
socket.on('dm:typing', ({ meId, otherUserId, senderName }) => {
  const room = makePairKey(meId, otherUserId);
  // send to the other peer(s) in the DM room (not back to the typer)
  socket.to(room).emit('dm:userTyping', { userId: meId, senderName });
});

socket.on('dm:stopTyping', ({ meId, otherUserId, senderName }) => {
  const room = makePairKey(meId, otherUserId);
  socket.to(room).emit('dm:userStoppedTyping', { userId: meId, senderName });
});


});


// ✅ Set global references
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// ✅ Start HTTP + Socket.IO

// ✅ Make Socket.IO + connected users accessible in routes/controllers
app.set('io', io);
app.set('connectedUsers', connectedUsers);


// ✅ Start both HTTP and WebSocket servers
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
server.listen(port, () => {
    console.log(`🚀 Server listening on http://localhost:${port}`);
});


// require('rootpath')();
// const express = require('express');
// const app = express();
// const http = require('http');
// const server = http.createServer(app);
// const { Server } = require('socket.io');
// const io = new Server(server, {
//     cors: {
//         origin: '*',
//         methods: ['GET', 'POST'],
//     },
// });

// const makePairKey = (a, b) => {
//   const [x, y] = [String(a), String(b)].sort();
//   return `dm:${x}_${y}`;
// };



// const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
// const cors = require('cors');
// const errorHandler = require('_middleware/error-handler');
// const imageRoutes = require('./uploads/image.controller');
// const db = require('./_helpers/db');
// const Message = db.Message;
// const ChatroomMessage = require('./chatroomMessages/chatroomMessage.model');
// const chatroomMessageRoutes = require('./chatroomMessages/chatroomMessage.routes');

// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// app.use(cookieParser());
// app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// // Routes
// app.use('/accounts', require('./accounts/accounts.controller'));
// app.use('/messages', require('./messages/messages.routes'));
// app.use('/chatrooms', require('./chatroom/chatroom.controller'));
// app.use('/uploads', express.static('public/uploads'));
// app.use('/uploads', express.static('uploads'));
// app.use('/api', imageRoutes);
// app.use('/api-docs', require('_helpers/swagger'));
// app.use('/api/chatroom-messages', chatroomMessageRoutes);
// app.use(errorHandler);

// // ✅ In-memory store for connected users
// const connectedUsers = {};

// io.on('connection', (socket) => {
//     console.log('🟢 Socket connected:', socket.id);

//     // Register user
//     socket.on('register', (userId) => {
//         connectedUsers[userId] = socket.id;
//         console.log(`✅ Registered user ${userId} to socket ${socket.id}`);
//     });

//     // Join chatroom
//     socket.on('joinChatroom', ({ chatroomId, userId }) => {
//         socket.join(chatroomId);
//         console.log(`👥 User ${userId} joined chatroom ${chatroomId}`);
//         io.to(chatroomId).emit('userJoined', { userId });
//     });

//     // Leave chatroom
//     socket.on('leaveChatroom', ({ chatroomId, userId }) => {
//         socket.leave(chatroomId);
//         console.log(`👤 User ${userId} left chatroom ${chatroomId}`);
//         io.to(chatroomId).emit('userLeft', { userId });
//     });

//     // Send chatroom message (save and broadcast)
//     socket.on('sendChatroomMessage', async ({ chatroomId, senderId, message, media }) => {
//         try {
//             const newMessage = await ChatroomMessage.create({
//                 chatroomId,
//                 senderId,
//                 message,
//                 media,
//                 readBy: [senderId],
//             });

//             io.to(chatroomId).emit('newChatroomMessage', newMessage);
//             console.log(`💬 Message sent to chatroom ${chatroomId}`);
//         } catch (err) {
//             console.error('❌ Error sending chatroom message:', err);
//         }
//     });

//     // Typing indicators
// // Typing indicators
// socket.on('typing', ({ chatroomId, userId, senderName }) => {
//   socket.to(chatroomId).emit('userTyping', { userId, senderName });  // ✅ forward name
// });

// socket.on('stopTyping', ({ chatroomId, userId, senderName }) => {
//   socket.to(chatroomId).emit('userStoppedTyping', { userId, senderName }); // ✅ forward name
// });


//     // socket.on('typing', ({ chatroomId, userId }) => {
//     //     socket.to(chatroomId).emit('userTyping', { userId });
//     // });

//     // socket.on('stopTyping', ({ chatroomId, userId }) => {
//     //     socket.to(chatroomId).emit('userStoppedTyping', { userId });
//     // });

//     // Read receipts (for private chats)

//     socket.on('readMessages', async ({ readerId, senderId }) => {
//   try {
//     await Message.updateMany(
//       { senderId, recipientId: readerId, read: false },
//       { $set: { read: true } }
//     );

//     const room = makePairKey(readerId, senderId);

//     // ✅ Tell both sides that messages were read (so sender can flip ticks)
//     io.to(room).emit('message:read', { readerId, otherId: senderId });

//     // ✅ Also patch chat-list rows to reflect unread = 0 for the reader
//     io.to(room).emit('conversation:update', {
//       peerA: readerId,
//       peerB: senderId,
//       unreadResetFor: readerId
//     });
//   } catch (error) {
//     console.error('❌ Failed to mark messages as read:', error);
//   }
// });

//     // socket.on('readMessages', async ({ readerId, senderId }) => {
//     //     try {
//     //         await Message.updateMany(
//     //             { senderId, recipientId: readerId, read: false },
//     //             { $set: { read: true } }
//     //         );

//     //         const senderSocketId = connectedUsers[senderId];
//     //         if (senderSocketId) {
//     //             io.to(senderSocketId).emit('messagesRead', { from: readerId });
//     //             console.log(`📬 Read receipt sent to user ${senderId}`);
//     //         }
//     //     } catch (error) {
//     //         console.error('❌ Failed to mark messages as read:', error);
//     //     }
//     // });

//     socket.on('disconnect', () => {
//         console.log('🔴 Socket disconnected:', socket.id);
//         for (const userId in connectedUsers) {
//             if (connectedUsers[userId] === socket.id) {
//                 delete connectedUsers[userId];
//                 break;
//             }
//         }
//     });

//     // ✅ DM: join/leave a 1:1 conversation room
// socket.on('dm:join', ({ meId, otherUserId }) => {
//   const room = makePairKey(meId, otherUserId);
//   socket.join(room);
//   // optional: console.log(`DM join ${room}`);
// });

// socket.on('dm:leave', ({ meId, otherUserId }) => {
//   const room = makePairKey(meId, otherUserId);
//   socket.leave(room);
// });

// });


// // ✅ Set global references
// app.set('io', io);
// app.set('connectedUsers', connectedUsers);

// // ✅ Start HTTP + Socket.IO

// // ✅ Make Socket.IO + connected users accessible in routes/controllers
// app.set('io', io);
// app.set('connectedUsers', connectedUsers);


// // ✅ Start both HTTP and WebSocket servers
// const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
// server.listen(port, () => {
//     console.log(`🚀 Server listening on http://localhost:${port}`);
// });
