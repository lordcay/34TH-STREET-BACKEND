// const Report = require('../reportUser/report.model');
// const sendReportEmail = require('../utils/sendReportEmail');
// const db = require('_helpers/db');

// async function createReport(req, res, next) {
//   try {
//     const reporterId = req.user.id;
//     const { reportedUserId, reason, extra } = req.body;

//     // ✅ Validation
//     if (!reportedUserId || !reason) {
//       return res.status(400).json({ message: 'reportedUserId and reason are required' });
//     }

//     const reporter = await db.Account.findById(reporterId);
//     const reportedUser = await db.Account.findById(reportedUserId);

//     if (!reporter || !reportedUser) {
//       return res.status(404).json({ message: 'User(s) not found' });
//     }

//     const report = await db.Report.create({
//       reporterId,
//       reportedUserId,
//       reason,
//       extra,
//     });

//     // ✅ Auto-send email
//     await sendReportEmail({ reporter, reportedUser, reason, extra });

//     res.json({ message: '✅ Report submitted successfully' });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = {
//   create: createReport,
// };


// const Report = require('../reportUser/report.model');
// const sendReportEmail = require('../utils/sendReportEmail');

// const db = require('_helpers/db');

const Report = require('../reportUser/report.model');
const sendReportEmail = require('../utils/sendReportEmail');


exports.createReport = async (req, res) => {
  try {
    const { reportedUser, reason } = req.body;
    const reporter = req.user.id;

    if (!reportedUser || !reason) {
      return res.status(400).json({ message: 'Missing reportedUser or reason' });
    }

    const report = new Report({ reporter, reportedUser, reason });
    await report.save();

    res.status(201).json({ message: 'Report submitted', report });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting report', error: err.message });
  }
};
