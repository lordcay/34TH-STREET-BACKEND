// report.controller.js
const Report = require('./report.model')
// const sendReportEmail = require('../utils/sendReportEmail') // keep if you use it

exports.createReport = async (req, res) => {
  try {
    const { reportedUser, reason } = req.body
    const reporter = req.user.id

    if (!reportedUser || !reason) {
      return res.status(400).json({ message: 'Missing reportedUser or reason' })
    }

    const report = new Report({ reporter, reportedUser, reason })
    await report.save()

    return res.status(201).json({ message: 'Report submitted', report })
  } catch (err) {
    return res.status(500).json({ message: 'Error submitting report', error: err.message })
  }
}

exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'firstName lastName email')
      .populate('reportedUser', 'firstName lastName email')
      .sort({ createdAt: -1 })

    return res.json(reports)
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching reports', error: err.message })
  }
}

exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'firstName lastName email')
      .populate('reportedUser', 'firstName lastName email')

    if (!report) return res.status(404).json({ message: 'Report not found' })

    return res.json(report)
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching report', error: err.message })
  }
}

exports.updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['NEW', 'IN_REVIEW', 'RESOLVED']

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const update = { status }
    if (status === 'RESOLVED') update.resolvedAt = new Date()

    const report = await Report.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('reporter', 'firstName lastName email')
      .populate('reportedUser', 'firstName lastName email')

    if (!report) return res.status(404).json({ message: 'Report not found' })

    return res.json({ message: 'Report updated', report })
  } catch (err) {
    return res.status(500).json({ message: 'Error updating report', error: err.message })
  }
}



// const Report = require('../reportUser/report.model');
// const sendReportEmail = require('../utils/sendReportEmail');


// exports.createReport = async (req, res) => {
//   try {
//     const { reportedUser, reason } = req.body;
//     const reporter = req.user.id;

//     if (!reportedUser || !reason) {
//       return res.status(400).json({ message: 'Missing reportedUser or reason' });
//     }

//     const report = new Report({ reporter, reportedUser, reason });
//     await report.save();

//     res.status(201).json({ message: 'Report submitted', report });
//   } catch (err) {
//     res.status(500).json({ message: 'Error submitting report', error: err.message });
//   }
// };
