const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const reportController = require('./report.controller');

 router.post('/', authorize(), reportController.createReport);
// router.post('/', reportController.create);           // ✅ Must be defined in controller
// router.post('/notify', reportController.notify);     // ✅ Optional: only if you implemented it

module.exports = router;
