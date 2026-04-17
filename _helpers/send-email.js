const sgMail = require('@sendgrid/mail');
const config = require('config.js');

// Initialize SendGrid with API key
sgMail.setApiKey(config.sendGridApiKey);

module.exports = sendEmail;

/**
 * Send email via SendGrid API
 * Using SendGrid API is better than SMTP because:
 * - No socket timeouts (HTTP-based, not SMTP protocol)
 * - Built-in retry logic and message queuing
 * - Better deliverability tracking and analytics
 * - Connection pooling handled by SendGrid infrastructure
 * - Faster, more reliable delivery
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @param {string} options.from - Sender email (must use verified SendGrid sender)
 * @param {number} retryCount - Internal retry counter
 */
async function sendEmail({ to, subject, html, text, from = config.emailFrom }, retryCount = 0) {
    try {
        // Validate inputs
        if (!to || !to.includes('@')) {
            throw new Error(`Invalid recipient email: ${to}`);
        }
        if (!subject || typeof subject !== 'string') {
            throw new Error('Subject is required and must be a string');
        }
        if (!html && !text) {
            throw new Error('Either HTML or plain text content is required');
        }
        if (!from || !from.includes('@')) {
            throw new Error(`Invalid sender email: ${from}. Must be a verified SendGrid sender.`);
        }

        console.log(`📧 [SendGrid] Sending email...`);
        console.log(`   To: ${to}`);
        console.log(`   From: ${from}`);
        console.log(`   Subject: ${subject}`);

        const msg = {
            to,
            from,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''),
        };

        // Send via SendGrid API
        const result = await sgMail.send(msg);
        
        console.log(`✅ [SendGrid] Email sent successfully!`);
        console.log(`   Recipient: ${to}`);
        console.log(`   Message ID: ${result[0].headers['x-message-id']}`);
        return result;

    } catch (error) {
        // Parse SendGrid error response
        const errMsg = error.response?.body?.errors?.[0]?.message || error.message;
        const errCode = error.code || error.response?.status || 'UNKNOWN';
        
        console.error(`❌ [SendGrid] Attempt ${retryCount + 1} failed to ${to}`);
        console.error(`   Error: ${errMsg}`);
        console.error(`   Code: ${errCode}`);

        // Retry logic with exponential backoff (max 3 attempts total)
        if (retryCount < 2) {
            const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`⏳ [SendGrid] Retrying in ${waitTime}ms (attempt ${retryCount + 2}/3)...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return sendEmail({ to, subject, html, text, from }, retryCount + 1);
        }

        // All retries exhausted
        console.error(`❌ [SendGrid] Failed after 3 attempts to deliver to ${to}`);
        throw new Error(`Email delivery failed: ${errMsg}`);
    }
}