// const mongoose = require('mongoose');

// const db = require('_helpers/db');

// module.exports = {
//   create,
//   getMessagesBetweenUsers,
//   getUserConversations
// };

// async function create({ senderId, recipientId, message }) {
//   const newMessage = new db.Message({ senderId, recipientId, message });
//   await newMessage.save();
//   return newMessage;
// }

// async function getMessagesBetweenUsers(currentUserId, otherUserId) {
//   await markMessagesAsRead(currentUserId, otherUserId);
//   return await db.Message.find({
//     $or: [
//       { senderId: currentUserId, recipientId: otherUserId },
//       { senderId: otherUserId, recipientId: currentUserId }
//     ]
//   }).sort({ timestamp: 1 });
// }





// async function getUserConversations(currentUserId) {
//   const messages = await db.Message.aggregate([
//     {
//       $match: {
//         $or: [
//           { senderId: new mongoose.Types.ObjectId(currentUserId) },
//           { recipientId: new mongoose.Types.ObjectId(currentUserId) }
//         ]
//       }
//     },
//     {
//       $sort: { timestamp: -1 }
//     },
//     {
//       $group: {
//         _id: {
//           $cond: [
//             { $eq: ["$senderId", new mongoose.Types.ObjectId(currentUserId)] },
//             "$recipientId",
//             "$senderId"
//           ]
//         },
//         lastMessage: { $first: "$message" },
//         timestamp: { $first: "$timestamp" }
//       }
//     },
//     {
//       $lookup: {
//         from: "accounts", // Make sure your Mongo collection is named "accounts"
//         localField: "_id",
//         foreignField: "_id",
//         as: "user"
//       }
//     },
//     {
//       $unwind: "$user"
//     },
//     {
//       $lookup: {
//         from: "messages",
//         let: { otherUserId: "$user._id" },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ["$senderId", "$$otherUserId"] },
//                   { $eq: ["$recipientId", new mongoose.Types.ObjectId(currentUserId)] },
//                   { $eq: ["$read", false] }
//                 ]
//               }
//             }
//           }
//         ],
//         as: "unreadMessages"
//       }
//     },
//     {
//       $addFields: {
//         unreadCount: { $size: "$unreadMessages" }
//       }
//     },

//     {
//       $project: {
//         userId: "$user._id",
//         firstName: "$user.firstName",
//         lastName: "$user.lastName",
//         email: "$user.email",
//         photos: "$user.photos", // ✅ Include profile photos
//         lastMessage: 1,
//         timestamp: 1
//       }
//     },
//     {
//       $sort: { timestamp: -1 }
//     }
//   ]);

//   return messages;
// }

// async function markMessagesAsRead(currentUserId, otherUserId) {
//   await db.Message.updateMany(
//     {
//       senderId: otherUserId,
//       recipientId: currentUserId,
//       read: false
//     },
//     { $set: { read: true } }
//   );
// }


// messages/message.service.js
const mongoose = require('mongoose');
const db = require('_helpers/db');

module.exports = {
  create,
  getMessagesBetweenUsers,
  getUserConversations,
  findByIdPopulated,
  addReaction,
  removeReaction,
  deleteMessage,
  deleteMessageForMe,
};

async function create({ 
  senderId, 
  recipientId, 
  message, 
  replyTo = null,
  // Media fields
  messageType = 'text',
  mediaUrl = null,
  fileName = null,
  fileSize = null,
  mimeType = null,
  duration = null,
  thumbnail = null,
  contactInfo = null,
}) {
  const newMessage = new db.Message({ 
    senderId, 
    recipientId, 
    message: message || '',
    replyTo: replyTo || null,
    // Media fields
    messageType,
    mediaUrl,
    fileName,
    fileSize,
    mimeType,
    duration,
    thumbnail,
    contactInfo,
  });
  await newMessage.save();
  return newMessage;
}

async function findByIdPopulated(id) {
  return db.Message.findById(id)
    .populate('senderId', '_id firstName lastName photos')
    .populate('recipientId', '_id firstName lastName photos')
    .populate({
      path: 'replyTo',
      select: '_id message senderId timestamp',
      populate: { path: 'senderId', select: '_id firstName lastName' }
    })
    .populate('reactions.userId', '_id firstName lastName')
    .lean()
    .exec();
}

async function getMessagesBetweenUsers(currentUserId, otherUserId) {
  await markMessagesAsRead(currentUserId, otherUserId);

  const messages = await db.Message.find({
    $or: [
      { senderId: currentUserId, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: currentUserId },
    ],
    // Filter out messages deleted for the current user
    deletedForUsers: { $ne: currentUserId },
  })
    .populate('senderId', '_id firstName lastName photos')
    .populate('recipientId', '_id firstName lastName photos')
    .populate({
      path: 'replyTo',
      select: '_id message senderId timestamp deletedForEveryone',
      populate: { path: 'senderId', select: '_id firstName lastName' }
    })
    .populate('reactions.userId', '_id firstName lastName')
    .populate('deletedBy', '_id firstName lastName')
    .sort({ timestamp: 1 })
    .lean()
    .exec();

  return messages;
}

// Add or update a reaction
async function addReaction(messageId, userId, emoji) {
  const message = await db.Message.findById(messageId);
  if (!message) throw new Error('Message not found');

  // Remove existing reaction from this user (one reaction per user)
  message.reactions = message.reactions.filter(
    r => String(r.userId) !== String(userId)
  );
  
  // Add new reaction
  message.reactions.push({ userId, emoji });
  await message.save();
  
  return findByIdPopulated(messageId);
}

// Remove a reaction
async function removeReaction(messageId, userId) {
  const message = await db.Message.findById(messageId);
  if (!message) throw new Error('Message not found');

  message.reactions = message.reactions.filter(
    r => String(r.userId) !== String(userId)
  );
  await message.save();
  
  return findByIdPopulated(messageId);
}

async function getUserConversations(currentUserId) {
  const messages = await db.Message.aggregate([
    {
      $match: {
        $or: [
          { senderId: new mongoose.Types.ObjectId(currentUserId) },
          { recipientId: new mongoose.Types.ObjectId(currentUserId) },
        ],
      },
    },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$senderId', new mongoose.Types.ObjectId(currentUserId)] },
            '$recipientId',
            '$senderId',
          ],
        },
        lastMessage: { $first: '$message' },
        timestamp: { $first: '$timestamp' },
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $lookup: {
        from: 'messages',
        let: { otherUserId: '$user._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$senderId', '$$otherUserId'] },
                  { $eq: ['$recipientId', new mongoose.Types.ObjectId(currentUserId)] },
                  { $eq: ['$read', false] },
                ],
              },
            },
          },
        ],
        as: 'unreadMessages',
      },
    },
    { $addFields: { unreadCount: { $size: '$unreadMessages' } } },
    {
      $project: {
        userId: '$user._id',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        email: '$user.email',
        photos: '$user.photos',
        lastMessage: 1,
        timestamp: 1,
      },
    },
    { $sort: { timestamp: -1 } },
  ]);

  return messages;
}

// internal
async function markMessagesAsRead(currentUserId, otherUserId) {
  await db.Message.updateMany(
    {
      senderId: otherUserId,
      recipientId: currentUserId,
      read: false,
    },
    { $set: { read: true } }
  );
}

// ─────────────────────────────────────────────────────────
// Delete Message Functions (WhatsApp-style)
// ─────────────────────────────────────────────────────────

// Delete message for everyone (only sender can do this)
async function deleteMessage(messageId, userId) {
  const message = await db.Message.findById(messageId);
  if (!message) throw new Error('Message not found');

  // Only the sender can delete for everyone
  if (String(message.senderId) !== String(userId)) {
    throw new Error('You can only delete your own messages for everyone');
  }

  // Mark as deleted for everyone
  message.deletedForEveryone = true;
  message.deletedBy = userId;
  await message.save();

  return message;
}

// Delete message for me only
async function deleteMessageForMe(messageId, userId) {
  const message = await db.Message.findById(messageId);
  if (!message) throw new Error('Message not found');

  // Check if user is part of this conversation
  const isSender = String(message.senderId) === String(userId);
  const isRecipient = String(message.recipientId) === String(userId);
  
  if (!isSender && !isRecipient) {
    throw new Error('You are not authorized to delete this message');
  }

  // Add user to deletedForUsers array if not already there
  if (!message.deletedForUsers.includes(userId)) {
    message.deletedForUsers.push(userId);
  }
  await message.save();

  return message;
}
