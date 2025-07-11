const messageService = require('./message.service');

module.exports = {
  sendMessage,
  getMessages,
  getConversations
};

async function sendMessage(req, res, next) {
  try {
    const senderId = req.user.id;
    const { recipientId, message } = req.body;
    const created = await messageService.create({ senderId, recipientId, message });
    res.json(created);
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    const messages = await messageService.getMessagesBetweenUsers(currentUserId, otherUserId);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

async function getConversations(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const conversations = await messageService.getUserConversations(currentUserId);
    res.json(conversations);
  } catch (err) {
    next(err);
  }
}

