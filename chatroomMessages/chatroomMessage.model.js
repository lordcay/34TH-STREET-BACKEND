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

// Schema for nested replies on a message
const nestedReplySchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    senderName: { type: String },
    avatarUrl: { type: String },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Account' }],
}, { _id: true });

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
        // Nested replies (threaded conversation on a message)
        replies: [nestedReplySchema],
        // Likes array for message reactions
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Account',
            },
        ],
        // Mentioned users extracted from @mentions
        mentions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Account',
            },
        ],
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

// Virtual for like count
chatroomMessageSchema.virtual('likeCount').get(function() {
    return this.likes ? this.likes.length : 0;
});

// Virtual for reply count
chatroomMessageSchema.virtual('replyCount').get(function() {
    return this.replies ? this.replies.length : 0;
});

module.exports = mongoose.model('ChatroomMessage', chatroomMessageSchema);
