


// require('rootpath')();
// // require('dotenv').config();
// const express = require('express');
// const app = express();
// const http = require('http'); // ✅ Required for Socket.IO server
// const server = http.createServer(app);
// const { Server } = require('socket.io');
// const io = new Server(server, {
//     cors: {
//         origin: '*', // Allow from frontend
//         methods: ['GET', 'POST']
//     }
// });

// global.io = io; // ✅ ✅ ✅ Add this line


// const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
// const cors = require('cors');
// const errorHandler = require('_middleware/error-handler');
// const imageRoutes = require('./uploads/image.controller');
// const db = require('./_helpers/db'); // ✅ Make sure db is imported
// const Message = db.Message; // ✅ Access your Message model
// const ChatroomMessage = require('./chatroomMessages/chatroomMessage.model');
// const chatroomMessageRoutes = require('./chatroomMessages/chatroomMessage.routes'); // adjust path as needed



// // Middleware
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// app.use(cookieParser());
// app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// // Routes
// app.use('/accounts', require('./accounts/accounts.controller'));
// app.use('/messages', require('./messages/messages.routes'));
// app.use('/chatrooms', require('./chatroom/chatroom.controller')); // ✅ Add this line
// app.use('/uploads', express.static('public/uploads'));
// app.use('/uploads', express.static('uploads'));
// app.use('/api', imageRoutes);
// app.use('/api-docs', require('_helpers/swagger'));
// app.use(errorHandler);
// app.use('/api/chatroom-messages', chatroomMessageRoutes);


// // ✅ Socket.IO Logic
// const connectedUsers = {};

// io.on('connection', (socket) => {
//     console.log('🟢 Socket connected:', socket.id);

//     // Register user to a socket
//     socket.on('register', (userId) => {
//         connectedUsers[userId] = socket.id;
//         console.log(`✅ Registered user ${userId} to socket ${socket.id}`);
//     });

//     io.on('connection', (socket) => {
//         console.log('🔌 A user connected');

//         socket.on('joinRoom', (chatroomId) => {
//             socket.join(chatroomId);
//             console.log(`User joined room ${chatroomId}`);
//         });

//         socket.on('sendChatroomMessage', async ({ chatroomId, senderId, message, media }) => {
//             const newMessage = await ChatroomMessage.create({
//                 chatroomId,
//                 senderId,
//                 message,
//                 media,
//                 readBy: [senderId],
//             });

//             io.to(chatroomId).emit('newChatroomMessage', newMessage); // Send to room
//         });

//         socket.on('disconnect', () => {
//             console.log('❌ A user disconnected');
//         });
//     });

//     // ✅ Chatroom: Join Room
//     socket.on('joinChatroom', ({ chatroomId, userId }) => {
//         socket.join(chatroomId);
//         console.log(`👥 User ${userId} joined chatroom ${chatroomId}`);
//         io.to(chatroomId).emit('userJoined', { userId });
//     });

//     // ✅ Chatroom: Leave Room
//     socket.on('leaveChatroom', ({ chatroomId, userId }) => {
//         socket.leave(chatroomId);
//         console.log(`👤 User ${userId} left chatroom ${chatroomId}`);
//         io.to(chatroomId).emit('userLeft', { userId });
//     });

//     // ✅ Chatroom: Send Message
//     socket.on('chatroomMessage', async ({ chatroomId, sender, message }) => {
//         const msgData = {
//             chatroomId,
//             sender,
//             message,
//             timestamp: new Date()
//         };

//         // (Optional) Save chatroom message to DB here

//         io.to(chatroomId).emit('newChatroomMessage', msgData);
//         console.log(`💬 Message sent to chatroom ${chatroomId} by ${sender.firstName}`);
//     });

//     // ✅ Chatroom: Typing Indicator (optional)
//     socket.on('typing', ({ chatroomId, userId }) => {
//         socket.to(chatroomId).emit('userTyping', { userId });
//     });


//     // Handle read receipts
//     socket.on('readMessages', async ({ readerId, senderId }) => {
//         try {
//             await Message.updateMany(
//                 {
//                     senderId,
//                     recipientId: readerId,
//                     read: false
//                 },
//                 { $set: { read: true } }
//             );

//             const senderSocketId = connectedUsers[senderId];
//             if (senderSocketId) {
//                 io.to(senderSocketId).emit('messagesRead', { from: readerId });
//                 console.log(`📬 Read receipt sent to user ${senderId}`);
//             }
//         } catch (error) {
//             console.error('❌ Failed to mark messages as read:', error);
//         }
//     });

//     // Handle disconnect
//     socket.on('disconnect', () => {
//         console.log('🔴 Socket disconnected:', socket.id);
//         for (const userId in connectedUsers) {
//             if (connectedUsers[userId] === socket.id) {
//                 delete connectedUsers[userId];
//                 break;
//             }
//         }
//     });
// });

// // ✅ Make Socket.IO + connected users accessible in routes/controllers
// app.set('io', io);
// app.set('connectedUsers', connectedUsers);


// // ✅ Start both HTTP and WebSocket servers
// const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
// server.listen(port, () => {
//     console.log(`🚀 Server listening on http://localhost:${port}`);
// });


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

<<<<<<< HEAD
global.io = io; // ✅ Global access if needed elsewhere
=======
global.io = io; // ✅ ✅ ✅ Add this line

>>>>>>> fb9cc96a2ece9a99d3ac0395c6d21bbebe921086

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
    socket.on('sendChatroomMessage', async ({ chatroomId, senderId, message, media }) => {
        try {
            const newMessage = await ChatroomMessage.create({
                chatroomId,
                senderId,
                message,
                media,
                readBy: [senderId],
            });

            io.to(chatroomId).emit('newChatroomMessage', newMessage);
            console.log(`💬 Message sent to chatroom ${chatroomId}`);
        } catch (err) {
            console.error('❌ Error sending chatroom message:', err);
        }
    });

    // Typing indicators
    socket.on('typing', ({ chatroomId, userId }) => {
        socket.to(chatroomId).emit('userTyping', { userId });
    });

    socket.on('stopTyping', ({ chatroomId, userId }) => {
        socket.to(chatroomId).emit('userStoppedTyping', { userId });
    });

    // Read receipts (for private chats)
    socket.on('readMessages', async ({ readerId, senderId }) => {
        try {
            await Message.updateMany(
                { senderId, recipientId: readerId, read: false },
                { $set: { read: true } }
            );

            const senderSocketId = connectedUsers[senderId];
            if (senderSocketId) {
                io.to(senderSocketId).emit('messagesRead', { from: readerId });
                console.log(`📬 Read receipt sent to user ${senderId}`);
            }
        } catch (error) {
            console.error('❌ Failed to mark messages as read:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Socket disconnected:', socket.id);
        for (const userId in connectedUsers) {
            if (connectedUsers[userId] === socket.id) {
                delete connectedUsers[userId];
                break;
            }
        }
    });
});

<<<<<<< HEAD
// ✅ Set global references
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// ✅ Start HTTP + Socket.IO
=======
// ✅ Make Socket.IO + connected users accessible in routes/controllers
app.set('io', io);
app.set('connectedUsers', connectedUsers);


// ✅ Start both HTTP and WebSocket servers
>>>>>>> fb9cc96a2ece9a99d3ac0395c6d21bbebe921086
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
server.listen(port, () => {
    console.log(`🚀 Server listening on http://localhost:${port}`);
});
