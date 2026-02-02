// const express = require('express');
// const router = express.Router();
// const feedService = require('./feed.service');

// async function getToday(req, res, next) {
//   try {
//     const userId = req.user?.id;
//     const data = await feedService.getToday(userId);
//     res.json(data);
//   } catch (err) {
//     next(err);
//   }
// }

// async function createToday(req, res, next) {
//   try {
//     const adminId = req.user?.id;
//     const post = await feedService.createToday(req.body, adminId);
//     res.json({ post });
//   } catch (err) {
//     next(err);
//   }
// }

// async function vote(req, res, next) {
//   try {
//     const userId = req.user?.id;
//     const { type } = req.body;
//     const out = await feedService.vote(req.params.postId, userId, type);
//     res.json(out);
//   } catch (err) {
//     next(err);
//   }
// }

// async function getComments(req, res, next) {
//   try {
//     const { limit } = req.query;
//     const comments = await feedService.getComments(req.params.postId, limit || 50);
//     res.json({ comments });
//   } catch (err) {
//     next(err);
//   }
// }

// async function addComment(req, res, next) {
//   try {
//     const userId = req.user?.id;
//     const { text } = req.body;
//     const comment = await feedService.addComment(req.params.postId, userId, text);
//     res.json({ comment });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = { getToday, createToday, vote, getComments, addComment };



const express = require('express');
const router = express.Router();
const feedService = require('./feed.service');

// ✅ works for both old + new express-jwt
const getUserId = (req) =>
  req.user?.id ||
  req.auth?.id ||
  req.auth?.sub ||
  req.user?.sub;

async function getToday(req, res, next) {
  try {
    const userId = getUserId(req);
    const data = await feedService.getToday(userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function createToday(req, res, next) {
  try {
    const adminId = getUserId(req);
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const post = await feedService.createToday(req.body, adminId);
    res.json({ post });
  } catch (err) {
    next(err);
  }
}

async function vote(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { type } = req.body;
    const out = await feedService.vote(req.params.postId, userId, type);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

async function getComments(req, res, next) {
  try {
    const { limit } = req.query;
    const comments = await feedService.getComments(req.params.postId, limit || 50);
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

async function addComment(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { text } = req.body;
    const comment = await feedService.addComment(req.params.postId, userId, text);
    res.json({ comment });
  } catch (err) {
    next(err);
  }
}

module.exports = { getToday, createToday, vote, getComments, addComment };
