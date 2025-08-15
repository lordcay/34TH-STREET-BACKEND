// models/chatroom.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatroomSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        coverPhoto: {
            type: String,
            default: '',
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'Account', // assuming your user model is named 'Account'
            required: true,
        },
        members: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Account',
            },
        ],
        messages: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Message',
            },
        ],
        tags: [String], // optional for discoverability
        isPrivate: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Chatroom', chatroomSchema);
