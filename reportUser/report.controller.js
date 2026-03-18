// report.controller.js
const Report = require('./report.model')

/**
 * Create a new report (user, post, comment, or chatroom_message)
 */
exports.createReport = async (req, res) => {
  try {
    const { reportType, reportedUser, reportedPost, reportedComment, reportedItemId, reportedUserId, chatroomId, messageContent, reasonCategory, reason } = req.body
    const reporter = req.user.id

    if (!reason) {
      return res.status(400).json({ message: 'Missing reason' })
    }

    // Validate based on report type
    const type = reportType || 'user';
    
    if (type === 'user' && !reportedUser) {
      return res.status(400).json({ message: 'Missing reportedUser for user report' })
    }
    if (type === 'post' && !reportedPost) {
      return res.status(400).json({ message: 'Missing reportedPost for post report' })
    }
    if (type === 'comment' && (!reportedComment?.postId || !reportedComment?.commentId)) {
      return res.status(400).json({ message: 'Missing postId or commentId for comment report' })
    }
    if (type === 'chatroom_message' && !reportedItemId) {
      return res.status(400).json({ message: 'Missing reportedItemId for chatroom message report' })
    }

    const reportData = {
      reporter,
      reportType: type,
      reasonCategory: reasonCategory || 'other',
      reason
    };

    if (type === 'user') reportData.reportedUser = reportedUser;
    if (type === 'post') reportData.reportedPost = reportedPost;
    if (type === 'comment') reportData.reportedComment = reportedComment;
    if (type === 'chatroom_message') {
      reportData.reportedChatroomMessage = {
        messageId: reportedItemId,
        chatroomId: chatroomId,
        messageContent: messageContent || ''
      };
      if (reportedUserId) reportData.reportedUser = reportedUserId;
    }

    const report = new Report(reportData)
    await report.save()

    return res.status(201).json({ 
      success: true,
      message: 'Report submitted successfully. We will review it shortly.',
      report 
    })
  } catch (err) {
    console.error('Create report error:', err);
    return res.status(500).json({ message: 'Error submitting report', error: err.message })
  }
}

/**
 * Report a post specifically
 */
exports.reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reasonCategory, reason } = req.body;
    const reporter = req.user.id;

    // At least reasonCategory or reason must be provided
    if (!reasonCategory && !reason) {
      return res.status(400).json({ message: 'Please provide a reason for reporting' });
    }

    const report = new Report({
      reporter,
      reportedPost: postId,
      reportType: 'post',
      reasonCategory: reasonCategory || 'other',
      reason
    });

    await report.save();

    return res.status(201).json({
      success: true,
      message: 'Post reported successfully. We will review it shortly.',
      report
    });
  } catch (err) {
    console.error('Report post error:', err);
    return res.status(500).json({ message: 'Error reporting post', error: err.message });
  }
};

/**
 * Report a comment specifically
 */
exports.reportComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { reasonCategory, reason } = req.body;
    const reporter = req.user.id;

    // At least reasonCategory or reason must be provided
    if (!reasonCategory && !reason) {
      return res.status(400).json({ message: 'Please provide a reason for reporting' });
    }

    const report = new Report({
      reporter,
      reportedComment: { postId, commentId },
      reportType: 'comment',
      reasonCategory: reasonCategory || 'other',
      reason
    });

    await report.save();

    return res.status(201).json({
      success: true,
      message: 'Comment reported successfully. We will review it shortly.',
      report
    });
  } catch (err) {
    console.error('Report comment error:', err);
    return res.status(500).json({ message: 'Error reporting comment', error: err.message });
  }
};

exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'firstName lastName email')
      .populate('reportedUser', 'firstName lastName email')
      .populate('reportedPost', 'content author')
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
      .populate('reportedPost', 'content author')

    if (!report) return res.status(404).json({ message: 'Report not found' })

    return res.json(report)
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching report', error: err.message })
  }
}

exports.updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const update = { status }
    if (status === 'RESOLVED' || status === 'DISMISSED') update.resolvedAt = new Date()

    const report = await Report.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('reporter', 'firstName lastName email')
      .populate('reportedUser', 'firstName lastName email')
      .populate('reportedPost', 'content author')

    if (!report) return res.status(404).json({ message: 'Report not found' })

    return res.json({ message: 'Report updated', report })
  } catch (err) {
    return res.status(500).json({ message: 'Error updating report', error: err.message })
  }
}
