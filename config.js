module.exports = {
    connectionString: process.env.CONNECTION_STRING || process.env.MONGODB_URI || 'mongodb+srv://calebs:calebs@cluster0.guzwh.mongodb.net/',
    JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_key',

    // SendGrid API key (used by send-email.js)
    sendGridApiKey: process.env.SENDGRID_API_KEY || '',

    emailFrom: process.env.EMAIL_FROM || 'support@34thstreet.net',
    smtpOptions: {
        host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 100,
        connectionTimeout: 5000,
        socketTimeout: 10000,
        auth: {
            user: process.env.SMTP_USER || 'apikey',
            pass: process.env.SMTP_PASS || ''
        }
    },

    // Report email settings
    REPORT_EMAIL: process.env.REPORT_EMAIL || 'support@34thstreet.net',
    REPORT_EMAIL_PASSWORD: process.env.REPORT_EMAIL_PASSWORD || '',
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || 'support@34thstreet.net'
};
