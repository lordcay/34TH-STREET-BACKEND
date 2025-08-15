const express = require('express');
const router = express.Router();
const chatroomService = require('./chatroom.service');
const authorize = require('../_middleware/authorize');

// Protected routes (requires authentication)
router.get('/', authorize(), getAll);
router.get('/:id', authorize(), getById);
router.post('/', authorize(), create);
router.post('/:id/join', authorize(), join);
router.post('/:id/leave', authorize(), leave);

module.exports = router;

// Controllers
async function create(req, res, next) {
    try {
        const chatroom = await chatroomService.create({
            ...req.body,
            createdBy: req.user.id,
            members: [req.user.id],
        });
        res.json(chatroom);
    } catch (err) {
        next(err);
    }
}

async function getAll(req, res, next) {
    try {
        const chatrooms = await chatroomService.getAll();
        res.json(chatrooms);
    } catch (err) {
        next(err);
    }
}

async function getById(req, res, next) {
    try {
        const chatroom = await chatroomService.getById(req.params.id);
        res.json(chatroom);
    } catch (err) {
        next(err);
    }
}

async function join(req, res, next) {
    try {
        const chatroom = await chatroomService.join(req.params.id, req.user.id);
        res.json(chatroom);
    } catch (err) {
        next(err);
    }
}

async function leave(req, res, next) {
    try {
        const chatroom = await chatroomService.leave(req.params.id, req.user.id);
        res.json(chatroom);
    } catch (err) {
        next(err);
    }
}
