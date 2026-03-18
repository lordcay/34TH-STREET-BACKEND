

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
const Account = db.Account;
const ChatroomMessage = require('./chatroomMessages/chatroomMessage.model');
const chatroomMessageRoutes = require('./chatroomMessages/chatroomMessage.routes');
const reportRoutes = require('./reportUser/report.routes');
const blockRoutes = require('./blockUser/block.routes');



app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
// app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));


const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://34thstreet-admin.pages.dev',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);
// app.use(
//   cors({
//     origin: ['http://localhost:3000'],
//     credentials: true,
//   })
// );


// Routes
app.use('/accounts', require('./accounts/accounts.controller'));
app.use('/messages', require('./messages/messages.routes'));
app.use('/chatrooms', require('./chatroom/chatroom.controller'));
app.use('/uploads', express.static('public/uploads'));
app.use('/uploads', express.static('uploads'));
app.use('/api', imageRoutes);
app.use('/api-docs', require('_helpers/swagger'));
app.use('/api/chatroom-messages', chatroomMessageRoutes);
app.use('/feed', require('./feed/feed.routes'));
app.use('/posts', require('./posts/post.routes'));

app.use('/reports', reportRoutes);
app.use('/blocks', blockRoutes);

// 🤝 Connection routes
app.use('/connections', require('./connections/connection.controller'));

// 🔔 Notification routes
app.use('/notifications', require('./notifications/notification.controller'));

app.use(errorHandler);


// ✅ In-memory store for connected users
const connectedUsers = {};

// ✅ In-memory store for active calls
const activeCalls = {};

// ✅ In-memory store for user activity timestamps (for inactive detection)
const userActivityTimestamps = {};

// ✅ Presence status constants
const PRESENCE_STATUS = {
  ONLINE: 'online',
  INACTIVE: 'inactive',
  OFFLINE: 'offline'
};

// ✅ Inactivity timeout (5 minutes = 300000ms)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

// ✅ Helper function to update user presence in database
async function updateUserPresence(userId, status) {
  try {
    const updateData = { onlineStatus: status };
    if (status === PRESENCE_STATUS.OFFLINE) {
      updateData.lastSeen = new Date();
    }
    if (status === PRESENCE_STATUS.ONLINE) {
      updateData.lastActivity = new Date();
    }
    await Account.findByIdAndUpdate(userId, updateData);
    console.log(`📍 User ${userId} presence updated to: ${status}`);
  } catch (error) {
    console.error('❌ Error updating user presence:', error);
  }
}

// ✅ Helper function to broadcast presence change to relevant users
function broadcastPresenceChange(userId, status, lastSeen = null) {
  io.emit('presence:update', { 
    userId, 
    status, 
    lastSeen: lastSeen || new Date().toISOString() 
  });
}

io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    // Register user
    socket.on('register', async (userId) => {
        connectedUsers[userId] = socket.id;
        userActivityTimestamps[userId] = Date.now();
        console.log(`✅ Registered user ${userId} to socket ${socket.id}`);
        
        // Update presence to online
        await updateUserPresence(userId, PRESENCE_STATUS.ONLINE);
        broadcastPresenceChange(userId, PRESENCE_STATUS.ONLINE);
    });

    // ✅ Handle user activity (heartbeat to stay online)
    socket.on('presence:activity', async (userId) => {
      if (userId && connectedUsers[userId]) {
        const wasInactive = userActivityTimestamps[userId] && 
          (Date.now() - userActivityTimestamps[userId] > INACTIVITY_TIMEOUT);
        
        userActivityTimestamps[userId] = Date.now();
        
        // If was inactive, update to online
        if (wasInactive) {
          await updateUserPresence(userId, PRESENCE_STATUS.ONLINE);
          broadcastPresenceChange(userId, PRESENCE_STATUS.ONLINE);
        }
      }
    });

    // ✅ Handle user going inactive (app backgrounded)
    socket.on('presence:inactive', async (userId) => {
      if (userId && connectedUsers[userId]) {
        await updateUserPresence(userId, PRESENCE_STATUS.INACTIVE);
        broadcastPresenceChange(userId, PRESENCE_STATUS.INACTIVE);
      }
    });

    // ✅ Handle user coming back from inactive
    socket.on('presence:active', async (userId) => {
      if (userId && connectedUsers[userId]) {
        userActivityTimestamps[userId] = Date.now();
        await updateUserPresence(userId, PRESENCE_STATUS.ONLINE);
        broadcastPresenceChange(userId, PRESENCE_STATUS.ONLINE);
      }
    });

    // ✅ Get presence status of a specific user
    socket.on('presence:get', async ({ userId }, callback) => {
      try {
        const user = await Account.findById(userId).select('onlineStatus lastSeen lastActivity');
        if (user) {
          callback({ 
            status: user.onlineStatus || PRESENCE_STATUS.OFFLINE, 
            lastSeen: user.lastSeen,
            lastActivity: user.lastActivity
          });
        } else {
          callback({ status: PRESENCE_STATUS.OFFLINE, lastSeen: null });
        }
      } catch (error) {
        console.error('❌ Error getting presence:', error);
        callback({ status: PRESENCE_STATUS.OFFLINE, lastSeen: null });
      }
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
    socket.on('sendChatroomMessage', async ({ chatroomId, senderId, message, media, senderName, avatarUrl, replyTo }) => {
  try {
    // 🔥 1. OBJECTIONABLE CONTENT FILTER (same as DM logic)
    const containsObjectionableContent = require('./utils/filterObjectionableContent');
    if (message && containsObjectionableContent(message)) {
      return io.to(socket.id).emit('chatroom:error', {
        message: 'Message contains inappropriate content.',
      });
    }
    
    // Create message with replyTo support for threading
    const newMessage = await ChatroomMessage.create({
      chatroomId, 
      senderId, 
      message, 
      media, 
      readBy: [senderId], 
      senderName, 
      avatarUrl,
      replyTo: replyTo || null, // ✅ Include replyTo for message threading
    });

    const payload = {
      ...newMessage.toObject(),
      senderName: senderName || 'Someone',
      replyTo: replyTo || null, // ✅ Ensure replyTo is in broadcast payload
    };

    console.log('📨 Broadcasting chatroom message:', { 
      _id: payload._id, 
      message: payload.message?.slice(0, 30), 
      hasReplyTo: !!payload.replyTo,
      replyToMessageId: payload.replyTo?.messageId 
    });

    io.to(chatroomId).emit('newChatroomMessage', payload);

     // 🔔 Also notify globally so users not joined to the room can bump badges
 io.emit('chatroom:notify', {
   chatroomId,
   senderId,
   messageId: newMessage._id, // optional, FYI
 });

    // (optional) also notify room members individually via push — handled below in section C
  } catch (err) {
    console.error('❌ Error sending chatroom message:', err);
  }
});

  

    // Typing indicators
// Typing indicators
socket.on('typing', ({ chatroomId, userId, senderName }) => {
  socket.to(chatroomId).emit('userTyping', { userId, senderName });  // ✅ forward name
});

socket.on('stopTyping', ({ chatroomId, userId, senderName }) => {
  socket.to(chatroomId).emit('userStoppedTyping', { userId, senderName }); // ✅ forward name
});


   

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

   

    socket.on('disconnect', async () => {
        console.log('🔴 Socket disconnected:', socket.id);
        let disconnectedUserId = null;
        for (const userId in connectedUsers) {
            if (connectedUsers[userId] === socket.id) {
                disconnectedUserId = userId;
                delete connectedUsers[userId];
                delete userActivityTimestamps[userId];
                break;
            }
        }
        
        // Update presence to offline
        if (disconnectedUserId) {
            await updateUserPresence(disconnectedUserId, PRESENCE_STATUS.OFFLINE);
            broadcastPresenceChange(disconnectedUserId, PRESENCE_STATUS.OFFLINE, new Date().toISOString());
        }
        
        // Clean up any active call for this user
        if (disconnectedUserId && activeCalls[disconnectedUserId]) {
            const { peerId } = activeCalls[disconnectedUserId];
            const peerSocketId = connectedUsers[peerId];
            
            // Notify the peer that the call ended due to disconnect
            if (peerSocketId) {
                io.to(peerSocketId).emit('call:ended', { 
                    endedBy: disconnectedUserId, 
                    reason: 'User disconnected' 
                });
            }
            
            delete activeCalls[peerId];
            delete activeCalls[disconnectedUserId];
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

// ═══════════════════════════════════════════════════════════════════
// WEBRTC CALL SIGNALING
// ═══════════════════════════════════════════════════════════════════

// Initiate a call
socket.on('call:initiate', ({ callerId, callerName, callerPhoto, calleeId, callType }) => {
  console.log(`📞 Call initiated: ${callerId} -> ${calleeId} (${callType})`);
  
  const calleeSocketId = connectedUsers[calleeId];
  
  if (!calleeSocketId) {
    // Callee is offline
    socket.emit('call:unavailable', { 
      calleeId, 
      reason: 'User is offline' 
    });
    return;
  }
  
  // Check if callee is already in a call
  if (activeCalls[calleeId]) {
    socket.emit('call:busy', { calleeId });
    return;
  }
  
  // Mark both users as in a call
  const callId = `${callerId}_${calleeId}_${Date.now()}`;
  activeCalls[callerId] = { callId, peerId: calleeId, callType };
  activeCalls[calleeId] = { callId, peerId: callerId, callType };
  
  // Send incoming call to callee
  io.to(calleeSocketId).emit('call:incoming', {
    callId,
    callerId,
    callerName,
    callerPhoto,
    callType,
  });
});

// WebRTC offer (SDP)
socket.on('call:offer', ({ calleeId, offer }) => {
  const calleeSocketId = connectedUsers[calleeId];
  if (calleeSocketId) {
    io.to(calleeSocketId).emit('call:offer', { offer });
  }
});

// WebRTC answer (SDP)
socket.on('call:answer', ({ callerId, answer }) => {
  const callerSocketId = connectedUsers[callerId];
  if (callerSocketId) {
    io.to(callerSocketId).emit('call:answer', { answer });
  }
});

// ICE candidate exchange
socket.on('call:ice-candidate', ({ peerId, candidate }) => {
  const peerSocketId = connectedUsers[peerId];
  if (peerSocketId) {
    io.to(peerSocketId).emit('call:ice-candidate', { candidate });
  }
});

// Accept call
socket.on('call:accept', ({ callerId, calleeId }) => {
  console.log(`✅ Call accepted: ${calleeId} accepted call from ${callerId}`);
  const callerSocketId = connectedUsers[callerId];
  if (callerSocketId) {
    io.to(callerSocketId).emit('call:accepted', { calleeId });
  }
});

// Reject call
socket.on('call:reject', ({ callerId, calleeId, reason }) => {
  console.log(`❌ Call rejected: ${calleeId} rejected call from ${callerId}`);
  
  // Clean up active calls
  delete activeCalls[callerId];
  delete activeCalls[calleeId];
  
  const callerSocketId = connectedUsers[callerId];
  if (callerSocketId) {
    io.to(callerSocketId).emit('call:rejected', { 
      calleeId, 
      reason: reason || 'Call declined' 
    });
  }
});

// End call
socket.on('call:end', ({ peerId, endedBy }) => {
  console.log(`📴 Call ended by ${endedBy}`);
  
  // Clean up active calls
  delete activeCalls[endedBy];
  delete activeCalls[peerId];
  
  const peerSocketId = connectedUsers[peerId];
  if (peerSocketId) {
    io.to(peerSocketId).emit('call:ended', { endedBy });
  }
});

// Toggle video during call
socket.on('call:toggle-video', ({ peerId, videoEnabled }) => {
  const peerSocketId = connectedUsers[peerId];
  if (peerSocketId) {
    io.to(peerSocketId).emit('call:video-toggled', { videoEnabled });
  }
});

// Toggle audio during call
socket.on('call:toggle-audio', ({ peerId, audioEnabled }) => {
  const peerSocketId = connectedUsers[peerId];
  if (peerSocketId) {
    io.to(peerSocketId).emit('call:audio-toggled', { audioEnabled });
  }
});

// ═══════════════════════════════════════════════════════════════════
// END WEBRTC CALL SIGNALING
// ═══════════════════════════════════════════════════════════════════


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
