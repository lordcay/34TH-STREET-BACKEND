const db = require('../_helpers/db');
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

  const post = await db.Feed.findById(postId);
  if (!post) throw 'Post not found';

  // already voted?
  const existing = await db.FeedVote.findOne({ post: postId, user: userId });

  // Same vote => remove
//   if (existing && existing.type === type) {
//     await db.FeedVote.deleteOne({ _id: existing._id });

//     const inc = type === 'agree' ? { agreeCount: -1 } : { disagreeCount: -1 };
//     await db.Feed.updateOne({ _id: postId }, { $inc: inc });

//     return { myVote: null };
//   }

if (existing && existing.type === type) {
  await db.FeedVote.deleteOne({ _id: existing._id });

  const inc = type === 'agree' ? { agreeCount: -1 } : { disagreeCount: -1 };
  await db.Feed.updateOne({ _id: postId }, { $inc: inc });

  const updatedPost = await db.Feed.findById(postId);
  return { post: updatedPost, myVote: null };
}


  // Switch vote or create new
  if (existing && existing.type !== type) {
    // update vote
    existing.type = type;
    await existing.save();

    // adjust counts: -old +new
    const dec = existing.type === 'agree' ? { disagreeCount: -1 } : { agreeCount: -1 }; // careful: existing.type now changed
    // We need oldType before overwrite:
  }

  // handle switch safely:
  if (existing) {
    const oldType = existing.type;
    existing.type = type;
    await existing.save();

    const inc = {};
    if (oldType === 'agree') inc.agreeCount = -1;
    if (oldType === 'disagree') inc.disagreeCount = -1;
    if (type === 'agree') inc.agreeCount = (inc.agreeCount || 0) + 1;
    if (type === 'disagree') inc.disagreeCount = (inc.disagreeCount || 0) + 1;

   await db.Feed.updateOne({ _id: postId }, { $inc: inc });

const updatedPost = await db.Feed.findById(postId);
return { post: updatedPost, myVote: type };

  }

  // create new vote
  await db.FeedVote.create({ post: postId, user: userId, type });

  const inc = type === 'agree' ? { agreeCount: 1 } : { disagreeCount: 1 };
await db.Feed.updateOne({ _id: postId }, { $inc: inc });

const updatedPost = await db.Feed.findById(postId);
return { post: updatedPost, myVote: type };


//   const inc = type === 'agree' ? { agreeCount: 1 } : { disagreeCount: 1 };
//   await db.Feed.updateOne({ _id: postId }, { $inc: inc });
//   const updatedPost = await db.Feed.findById(postId);
// return { post: updatedPost, myVote: type };

//   return { myVote: type };
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
