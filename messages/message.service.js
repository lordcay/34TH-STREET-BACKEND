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
  findByIdPopulated, // <- new helper for consistent controller responses
};

async function create({ senderId, recipientId, message }) {
  const newMessage = new db.Message({ senderId, recipientId, message });
  await newMessage.save();
  return newMessage; // controller may call findByIdPopulated for uniform shape
}

async function findByIdPopulated(id) {
  return db.Message.findById(id)
    .populate('senderId', '_id firstName lastName photos')
    .populate('recipientId', '_id firstName lastName photos')
    .lean()
    .exec();
}

async function getMessagesBetweenUsers(currentUserId, otherUserId) {
  await markMessagesAsRead(currentUserId, otherUserId);

  return db.Message.find({
    $or: [
      { senderId: currentUserId, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: currentUserId },
    ],
  })
    .populate('senderId', '_id firstName lastName photos')
    .populate('recipientId', '_id firstName lastName photos')
    .sort({ timestamp: 1 }) // keep your existing 'timestamp'
    .lean()
    .exec();
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
