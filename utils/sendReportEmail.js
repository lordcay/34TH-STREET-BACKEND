const nodemailer = require('nodemailer');
const config = require('../config.json'); // Add EMAIL + PASSWORD there

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.REPORT_EMAIL,
    pass: config.REPORT_EMAIL_PASSWORD,
  },
});

async function sendReportEmail({ reporter, reportedUser, reason, extra }) {
  const mailOptions = {
    from: config.REPORT_EMAIL,
    to: config.ADMIN_NOTIFICATION_EMAIL, // You can forward it to yourself or a team Slack via email
    subject: '🚨 New User Report on 34th Street',
    html: `
      <h3>🚨 New Report Submitted</h3>
      <p><strong>Reporter:</strong> ${reporter?.firstName || 'N/A'} (${reporter?.email || 'N/A'})</p>
      <p><strong>Reported User:</strong> ${reportedUser?.firstName || 'N/A'} (${reportedUser?.email || 'N/A'})</p>
      <p><strong>Reason:</strong> ${reason}</p>
      ${extra ? `<p><strong>Extra Notes:</strong> ${extra}</p>` : ''}
      <hr />
      <p>Respond within 24 hours to stay compliant with App Store policy.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = sendReportEmail;