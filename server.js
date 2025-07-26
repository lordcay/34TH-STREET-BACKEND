// require('rootpath')();
// // require('dotenv').config();
// const express = require('express');
// const app = express();
// const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
// const cors = require('cors');
// const errorHandler = require('_middleware/error-handler');
// const imageRoutes = require('./uploads/image.controller');


// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// app.use(cookieParser());

// // allow cors requests from any origin and with credentials
// app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// // api routes
// app.use('/accounts', require('./accounts/accounts.controller'));
// app.use('/messages', require('./messages/messages.routes')); // ✅ Add this line
// app.use('/uploads', express.static('public/uploads')); // serve static images
// app.use('/uploads', express.static('uploads'));

// app.use('/api', imageRoutes); // route handler for uploading images



// // swagger docs route
// app.use('/api-docs', require('_helpers/swagger'));

// // global error handler
// app.use(errorHandler);

// // start server
// const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
// app.listen(port, () => {
//     console.log('Server listening on port ' + port);
// });


require('rootpath')();
// require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http'); // ✅ Required for Socket.IO server
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: '*', // Allow from frontend
        methods: ['GET', 'POST']
    }
});

global.io = io; // ✅ ✅ ✅ Add this line


const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');
const imageRoutes = require('./uploads/image.controller');
const db = require('./_helpers/db'); // ✅ Make sure db is imported
const Message = db.Message; // ✅ Access your Message model

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// Routes
app.use('/accounts', require('./accounts/accounts.controller'));
app.use('/messages', require('./messages/messages.routes'));
app.use('/uploads', express.static('public/uploads'));
app.use('/uploads', express.static('uploads'));
app.use('/api', imageRoutes);
app.use('/api-docs', require('_helpers/swagger'));
app.use(errorHandler);

// ✅ Socket.IO Logic
const connectedUsers = {};

io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    // Register user to a socket
    socket.on('register', (userId) => {
        connectedUsers[userId] = socket.id;
        console.log(`✅ Registered user ${userId} to socket ${socket.id}`);
    });

    // Handle read receipts
    socket.on('readMessages', async ({ readerId, senderId }) => {
        try {
            await Message.updateMany(
                {
                    senderId,
                    recipientId: readerId,
                    read: false
                },
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

    // Handle disconnect
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

// ✅ Make Socket.IO + connected users accessible in routes/controllers
app.set('io', io);
app.set('connectedUsers', connectedUsers);


// ✅ Start both HTTP and WebSocket servers
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
server.listen(port, () => {
    console.log(`🚀 Server listening on http://localhost:${port}`);
});
