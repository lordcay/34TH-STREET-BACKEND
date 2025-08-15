const Chatroom = require('./chatroom.model');

module.exports = {
    create,
    getAll,
    getById,
    join,
    leave,
};

async function create(params) {
    const chatroom = new Chatroom(params);
    return await chatroom.save();
}

async function getAll() {
    return await Chatroom.find().populate('createdBy', 'firstName lastName photos');
}

async function getById(id) {
    return await Chatroom.findById(id).populate('members', 'firstName lastName photos');
}

async function join(chatroomId, userId) {
    const chatroom = await Chatroom.findById(chatroomId);
    if (!chatroom.members.includes(userId)) {
        chatroom.members.push(userId);
        await chatroom.save();
    }
    return chatroom;
}

async function leave(chatroomId, userId) {
    const chatroom = await Chatroom.findById(chatroomId);
    chatroom.members = chatroom.members.filter(member => member.toString() !== userId);
    await chatroom.save();
    return chatroom;
}
