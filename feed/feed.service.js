const db = require('../_helpers/db');
const mongoose = require('mongoose');

const filterObjectionableContent = require('../utils/filterObjectionableContent'); // you already have this



const getDayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

async function getToday(userId) {
  const dayKey = getDayKey(new Date());

  const post = await db.Feed.findOne({ dayKey });
  if (!post) return null;

  let myVote = null;
  if (userId) {
    const v = await db.FeedVote.findOne({ post: post._id, user: userId });
    myVote = v?.type || null;
  }

  return { post, myVote };
}

async function createToday(params, adminId) {
  const title = String(params.title || '').trim();
  const body = String(params.body || '').trim();
  const imageUrl = String(params.imageUrl || '').trim();

  if (!title) throw 'Title is required';

  // basic objectionable filter (helps with Apple guideline 1.2)
  const titleCheck = filterObjectionableContent(title);
  if (titleCheck?.isObjectionable) throw 'Post contains blocked content';

  if (body) {
    const bodyCheck = filterObjectionableContent(body);
    if (bodyCheck?.isObjectionable) throw 'Post contains blocked content';
  }

  const dayKey = getDayKey(new Date());
  const expiresAt = params.expiresAt ? new Date(params.expiresAt) : endOfDay(new Date());

  // Upsert: only one gist per day
  const post = await db.Feed.findOneAndUpdate(
    { dayKey },
    {
      $set: {
        title,
        body,
        imageUrl,
        expiresAt,
        createdBy: adminId,
      },
      $setOnInsert: { agreeCount: 0, disagreeCount: 0, commentCount: 0 },
    },
    { new: true, upsert: true }
  );

  return post;
}

async function vote(postId, userId, type) {
  if (!['agree', 'disagree'].includes(type)) throw 'Invalid vote type';

const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const post = await db.Feed.findById(postId).session(session);
      if (!post) throw 'Post not found';

      // Find existing vote in this transaction
      const existing = await db.FeedVote.findOne({ post: postId, user: userId }).session(session);

      let deltaAgree = 0;
      let deltaDisagree = 0;
      let myVote = type;

      // ✅ Case 1: Tap same vote again => toggle off (delete vote)
      if (existing && existing.type === type) {
        await db.FeedVote.deleteOne({ _id: existing._id }).session(session);

        if (type === 'agree') deltaAgree = -1;
        if (type === 'disagree') deltaDisagree = -1;

        myVote = null;
      }

      // ✅ Case 2: Switch vote (agree -> disagree OR disagree -> agree)
      else if (existing && existing.type !== type) {
        const oldType = existing.type;

        existing.type = type;
        await existing.save({ session });

        // remove old
        if (oldType === 'agree') deltaAgree = -1;
        if (oldType === 'disagree') deltaDisagree = -1;

        // add new
        if (type === 'agree') deltaAgree += 1;
        if (type === 'disagree') deltaDisagree += 1;

        myVote = type;
      }

     // ✅ Case 3: New vote
else if (!existing) {
  let createdNew = false;

  try {
    await db.FeedVote.create([{ post: postId, user: userId, type }], { session });
    createdNew = true;
    myVote = type;

    // new vote => +1 on that type
    if (type === 'agree') deltaAgree = 1;
    if (type === 'disagree') deltaDisagree = 1;
  } catch (e) {
    // If two requests race, unique index can throw E11000
    if (String(e?.code) === '11000') {
      const v2 = await db.FeedVote.findOne({ post: postId, user: userId }).session(session);

      if (v2 && v2.type === type) {
        // toggle off
        await db.FeedVote.deleteOne({ _id: v2._id }).session(session);
        if (type === 'agree') deltaAgree = -1;
        if (type === 'disagree') deltaDisagree = -1;
        myVote = null;
      } else if (v2 && v2.type !== type) {
        // switch
        const oldType = v2.type;
        v2.type = type;
        await v2.save({ session });

        if (oldType === 'agree') deltaAgree = -1;
        if (oldType === 'disagree') deltaDisagree = -1;

        if (type === 'agree') deltaAgree += 1;
        if (type === 'disagree') deltaDisagree += 1;

        myVote = type;
      } else {
        // super edge case: can't find it after duplicate
        myVote = null;
      }
    } else {
      throw e;
    }
  }
}


      // ✅ Apply count changes + clamp to prevent negatives
      // Using aggregation pipeline update so we can do $max(0, count + delta)
      if (deltaAgree !== 0 || deltaDisagree !== 0) {
        await db.Feed.updateOne(
          { _id: postId },
          [
            {
              $set: {
                agreeCount: { $max: [0, { $add: ['$agreeCount', deltaAgree] }] },
                disagreeCount: { $max: [0, { $add: ['$disagreeCount', deltaDisagree] }] },
              },
            },
          ],
          { session }
        );
      }

      const updatedPost = await db.Feed.findById(postId).session(session);
      result = { post: updatedPost, myVote };
    });

    return result;
  } finally {
    session.endSession();
  }
}




async function getComments(postId, limit = 50) {
  const post = await db.Feed.findById(postId);
  if (!post) throw 'Post not found';

  const comments = await db.FeedComment.find({ post: postId })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('user', 'firstName lastName photos verified');

  return comments;
}

async function addComment(postId, userId, text) {
  const post = await db.Feed.findById(postId);
  if (!post) throw 'Post not found';

  const clean = String(text || '').trim();
  if (!clean) throw 'Comment text is required';

  const check = filterObjectionableContent(clean);
  if (check?.isObjectionable) throw 'Comment contains blocked content';

  const comment = await db.FeedComment.create({ post: postId, user: userId, text: clean });

  await db.Feed.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });

  const populated = await db.FeedComment.findById(comment._id).populate(
    'user',
    'firstName lastName photos verified'
  );

  return populated;
}

module.exports = {
  getToday,
  createToday,
  vote,
  getComments,
  addComment,
};
