module.exports = {
    connectionString: process.env.CONNECTION_STRING,
    secret: process.env.SECRET,
    JWT_SECRET: process.env.JWT_SECRET,

    emailFrom: process.env.EMAIL_FROM,
    smtpOptions: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    }
};
