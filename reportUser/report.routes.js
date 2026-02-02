
//report.routes.js
const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const reportController = require('./report.controller');

console.log("reportController keys:", Object.keys(reportController))

 router.post('/', authorize(), reportController.createReport);

 router.get('/', authorize(), reportController.getAllReports)
router.get('/:id', authorize(), reportController.getReportById)
router.patch('/:id/status', authorize(), reportController.updateReportStatus)
// router.post('/', reportController.create);           // ✅ Must be defined in controller
// router.post('/notify', reportController.notify);     // ✅ Optional: only if you implemented it

module.exports = router;
