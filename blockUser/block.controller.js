// const Block = require('../blockUser/block.model');

// exports.blockUser = async (req, res) => {
//   try {
//     const { blocked } = req.body;
//     const blocker = req.user.id;

//     if (!blocked) return res.status(400).json({ message: 'Missing blocked user ID' });

//     const alreadyBlocked = await Block.findOne({ blocker, blocked });
//     if (alreadyBlocked) return res.status(400).json({ message: 'User already blocked' });

//     const block = new Block({ blocker, blocked });
//     await block.save();

//     res.status(201).json({ message: 'User blocked', block });
//   } catch (err) {
//     res.status(500).json({ message: 'Error blocking user', error: err.message });
//   }
// };

// exports.unblockUser = async (req, res) => {
//   try {
//     const { blocked } = req.body;
//     const blocker = req.user.id;

//     await Block.findOneAndDelete({ blocker, blocked });

//     res.json({ message: 'User unblocked' });
//   } catch (err) {
//     res.status(500).json({ message: 'Error unblocking user', error: err.message });
//   }
// };

// exports.getBlockedUsers = async (req, res) => {
//   try {
//     const blocker = req.user.id;
//     const blocks = await Block.find({ blocker }).populate('blocked', 'firstName lastName email');

//     res.json({ blockedUsers: blocks });
//   } catch (err) {
//     res.status(500).json({ message: 'Error retrieving blocked users', error: err.message });
//   }
// };


const Block = require('./block.model');

exports.toggleBlock = async (req, res) => {
  try {
    const blocker = req.user.id;               // from auth middleware
    const blocked = req.body.blocked;

    if (!blocked) {
      return res.status(400).json({ message: 'Missing blocked user ID' });
    }

    const existingBlock = await Block.findOne({ blocker, blocked });

    if (existingBlock) {
      // Unblock user
      await existingBlock.deleteOne();
      return res.status(200).json({ message: 'User unblocked successfully' });
    }

    // Block user
    await Block.create({ blocker, blocked });
    return res.status(200).json({ message: 'User blocked successfully' });

  } catch (err) {
    console.error('❌ Toggle block error:', err);
    res.status(500).json({ message: 'Server error toggling block' });
  }
};


exports.checkBlockStatus = async (req, res) => {
  const blocker = req.user.id;
  const blocked = req.params.blockedId;

  const exists = await Block.exists({ blocker, blocked });
  res.json({ isBlocked: !!exists });
};

