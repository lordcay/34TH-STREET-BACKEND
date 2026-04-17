const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('../_middleware/validate-request');
const authorize = require('../_middleware/authorize');
const Role = require('../_helpers/role');
const schoolRequestService = require('./schoolRequest.service');

// ─── Public Routes (no auth required) ──────────────────
router.post('/send-otp', sendOtpSchema, sendOtp);
router.post('/resend-otp', resendOtpSchema, resendOtp);
router.post('/verify-otp', verifyOtpSchema, verifyOtp);
router.post('/submit', submitSchema, submit);

// ─── Admin Routes ──────────────────────────────────────
router.get('/', authorize(Role.Admin), getAll);
router.get('/stats', authorize(Role.Admin), getStats);
router.get('/:id', authorize(Role.Admin), getById);
router.post('/:id/approve', authorize(Role.Admin), approveRequest);
router.post('/:id/deny', authorize(Role.Admin), denyRequest);

module.exports = router;

// ─── Schema Validators ─────────────────────────────────

function sendOtpSchema(req, res, next) {
  const schema = Joi.object({
    schoolEmail: Joi.string().email().required(),
    firstName: Joi.string().allow('', null),
  });
  validateRequest(req, next, schema);
}

function resendOtpSchema(req, res, next) {
  const schema = Joi.object({
    schoolEmail: Joi.string().email().required(),
    firstName: Joi.string().allow('', null),
  });
  validateRequest(req, next, schema);
}

function verifyOtpSchema(req, res, next) {
  const schema = Joi.object({
    schoolEmail: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
  });
  validateRequest(req, next, schema);
}

function submitSchema(req, res, next) {
  const schema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    gender: Joi.string().valid('Male', 'Female', 'Non-binary').required(),
    phone: Joi.string().required(),
    schoolEmail: Joi.string().email().required(),
    program: Joi.string().required(),
    linkedIn: Joi.string().uri().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  });
  validateRequest(req, next, schema);
}

// ─── Route Handlers ─────────────────────────────────────

function sendOtp(req, res, next) {
  schoolRequestService.sendOtp(req.body)
    .then((result) => res.json(result))
    .catch(next);
}

function resendOtp(req, res, next) {
  schoolRequestService.resendOtp(req.body)
    .then((result) => res.json(result))
    .catch(next);
}

function verifyOtp(req, res, next) {
  schoolRequestService.verifyOtp(req.body)
    .then((result) => res.json(result))
    .catch(next);
}

function submit(req, res, next) {
  schoolRequestService.submitRequest(req.body)
    .then((result) => res.status(201).json(result))
    .catch(next);
}

function getAll(req, res, next) {
  const { status, page, limit, search } = req.query;
  schoolRequestService.getAll({
    status,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    search,
  })
    .then((result) => res.json(result))
    .catch(next);
}

function getStats(req, res, next) {
  schoolRequestService.getStats()
    .then((result) => res.json(result))
    .catch(next);
}

function getById(req, res, next) {
  schoolRequestService.getById(req.params.id)
    .then((result) => res.json(result))
    .catch(next);
}

function approveRequest(req, res, next) {
  schoolRequestService.approve(req.params.id, req.user.id)
    .then((result) => res.json(result))
    .catch(next);
}

function denyRequest(req, res, next) {
  const reason = req.body.reason || null;
  schoolRequestService.deny(req.params.id, req.user.id, reason)
    .then((result) => res.json(result))
    .catch(next);
}
