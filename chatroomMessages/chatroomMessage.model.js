// const mongoose = require('mongoose');

// const chatroomMessageSchema = new mongoose.Schema(
//     {
//         chatroomId: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Chatroom',
//             required: true,
//         },
//         senderId: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Account',
//             required: true,
//         },
//         message: {
//             type: String,
//             required: true,
//             trim: true,
//         },
//         media: [
//             {
//                 url: { type: String },
//                 type: { type: String, enum: ['image', 'video', 'file'], default: 'image' },
//             },
//         ],
//         readBy: [
//             {
//                 type: mongoose.Schema.Types.ObjectId,
//                 ref: 'Account',
//             },
//         ],
//     },
//     {
//         timestamps: true, // Adds createdAt and updatedAt fields
//     }
// );

// module.exports = mongoose.model('ChatroomMessage', chatroomMessageSchema);



// chatroomMessage.model.js
const mongoose = require('mongoose');

const replyToSchema = new mongoose.Schema({
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatroomMessage' }, // optional reference
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    senderName: { type: String },
    message: { type: String },
}, { _id: false });

const chatroomMessageSchema = new mongoose.Schema(
    {
        chatroomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chatroom',
            required: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
        },
        senderName: {
            type: String,
        },
        avatarUrl: {
            type: String,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        media: [
            {
                url: { type: String },
                type: { type: String, enum: ['image', 'video', 'file'], default: 'image' },
            },
        ],
        replyTo: replyToSchema,
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Account',
            },
        ],
    },
    {
        timestamps: true, // createdAt, updatedAt
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

module.exports = mongoose.model('ChatroomMessage', chatroomMessageSchema);
