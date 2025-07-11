const mongoose = require('mongoose');

const db = require('_helpers/db');

module.exports = {
  create,
  getMessagesBetweenUsers,
  getUserConversations
};

async function create({ senderId, recipientId, message }) {
  const newMessage = new db.Message({ senderId, recipientId, message });
  await newMessage.save();
  return newMessage;
}

async function getMessagesBetweenUsers(currentUserId, otherUserId) {
  return await db.Message.find({
    $or: [
      { senderId: currentUserId, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: currentUserId }
    ]
  }).sort({ timestamp: 1 });
}


async function getUserConversations(currentUserId) {
  const messages = await db.Message.aggregate([
    {
      $match: {
        $or: [
          { senderId: new mongoose.Types.ObjectId(currentUserId) },
          { recipientId: new mongoose.Types.ObjectId(currentUserId) }
        ]
      }
    },
    {
      $sort: { timestamp: -1 }
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$senderId", new mongoose.Types.ObjectId(currentUserId)] },
            "$recipientId",
            "$senderId"
          ]
        },
        lastMessage: { $first: "$message" },
        timestamp: { $first: "$timestamp" }
      }
    },
    {
      $lookup: {
        from: "accounts",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    {
      $unwind: "$user"
    },
    {
      $project: {
        userId: "$user._id",
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        email: "$user.email",
        lastMessage: 1,
        timestamp: 1
      }
    },
    {
      $sort: { timestamp: -1 }
    }
  ]);

  return messages;
}

