# 34th Street Backend - Email & OTP System Documentation

## Overview
This documentation describes the modern OTP (One-Time Password) and email verification system implemented in the 34th Street backend.

## Architecture

### Core Components

1. **config.js** - Configuration with environment variable fallbacks
2. **send-email.js** - Enhanced email service with validation and retry logic
3. **account.service.js** - Business logic for registration, OTP, and password reset
4. **accounts.controller.js** - API endpoints and request validation

## Email Service Features

### Modern Design Patterns
- **Environment Variable Management**: Secure handling of sensitive credentials
- **Retry Logic**: Exponential backoff for failed email sends (1s, 2s)
- **Error Handling**: Comprehensive error logging and validation
- **SMTP Authentication**: SendGrid integration with proper configuration
- **HTML Templates**: Professional, responsive email design with dark mode support

### Configuration Files

#### config.js
```javascript
{
  SMTP_HOST: 'smtp.sendgrid.net',
  SMTP_PORT: 587,
  SMTP_USER: 'apikey',
  SMTP_PASS: process.env.SENDGRID_API_KEY
}
```

#### config.json
Contains fallback values if environment variables are not set.

## OTP Flow

### 1. User Registration (`POST /accounts/register`)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword",
  "firstName": "John",
  "lastName": "Doe",
  "gender": "Male",
  "type": "MBA"
}
```

**Response:**
```json
{
  "message": "Account created. Verify OTP to continue.",
  "userId": "user_id",
  "email": "user@example.com",
  "otpSent": true,
  "status": "PENDING_VERIFICATION"
}
```

**Process:**
1. Email is normalized (lowercased and trimmed)
2. Check if email already verified (block re-registration)
3. Generate 6-digit OTP valid for 10 minutes
4. Save account with password hash
5. Send verification email with retry logic (max 3 attempts)
6. Return success regardless of email delivery (user can resend)

### 2. OTP Verification (`POST /accounts/verify-email`)

**Request:**
```json
{
  "token": "123456"
}
```

**Response:**
```json
{
  "message": "Verification successful, you can now login"
}
```

**Process:**
1. Find account with matching OTP and valid expiration
2. Mark account as verified
3. Clear OTP tokens
4. Send welcome email (async, doesn't block verification)
5. Return JWT token for immediate login

### 3. Resend OTP (`POST /accounts/resend-otp`)

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP sent successfully",
  "email": "user@example.com",
  "otpSent": true
}
```

**Features:**
- Rate limiting: Minimum 30 seconds between requests
- Fresh OTP generation with new 10-minute expiration
- Retry logic for email delivery
- Clear feedback if account already verified

### 4. Forgot Password (`POST /accounts/forgot-password`)

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If email exists, a reset link has been sent",
  "success": true
}
```

**Features:**
- Security: Doesn't reveal if email exists
- Generate 6-digit reset code valid for 24 hours
- Retry logic for email delivery
- Multiple reset attempts not possible (old token invalidated)

### 5. Reset Password (`POST /accounts/reset-password`)

**Request:**
```json
{
  "token": "123456",
  "password": "newSecurePassword",
  "confirmPassword": "newSecurePassword"
}
```

**Response:**
```json
{
  "message": "Password reset successful, you can now login"
}
```

## Email Templates

### Verification Email
- Professional header with gradient background
- Large, easy-to-read OTP code (monospace font)
- Backup verification link
- Expiration time (10 minutes)
- Support link

### Password Reset Email
- Similar modern design
- Reset code prominently displayed
- 24-hour expiration
- Security note for users who didn't request reset

### Welcome Email
- Personalized greeting
- Key features of the platform
- Next steps (complete profile, explore)
- Support link

## Error Handling

### Comprehensive Validation
1. **Email Validation**: Proper email format checking
2. **OTP Validation**: Expiration time verification
3. **Password Validation**: Minimum 6 characters, confirmation match
4. **SMTP Validation**: Configuration checking before sending

### Failure Scenarios
- Invalid or expired OTP: Clear error message
- Account already verified: Redirect to login
- Rate limiting: Retry after X seconds
- SMTP failure: Registration succeeds, user can resend OTP

## Security Measures

1. **Password Hashing**: bcryptjs with 10 rounds
2. **Token Expiration**: OTP (10 min), Reset (24 hrs)
3. **Rate Limiting**: Prevent OTP spam (30-second minimum)
4. **Email Privacy**: Forgot password doesn't confirm existence
5. **Secrets in Environment**: No hardcoded sensitive data
6. **Whitelist Fields**: Only allowed fields updated on account

## Modern Design Patterns Used

1. **Exponential Backoff**: Retry logic with increasing wait times
2. **Async/Await**: Clean, readable async code
3. **Separation of Concerns**: Service and controller layers
4. **Error Boundaries**: Try-catch with detailed logging
5. **Configuration Management**: Environment variables with fallbacks
6. **Rate Limiting**: Prevent abuse of OTP requests
7. **HTML Email**: Responsive, branded email templates

## Troubleshooting

### "EBADNAME ${SENDGRID_API_KEY}"
- **Cause**: Template literal in JSON file not being interpolated
- **Solution**: Use config.js for environment variables, not config.json

### Email Not Sending
- Check SMTP_PASS in environment variables
- Verify SendGrid account is active
- Check email logs in SendGrid dashboard
- User can always resend OTP if initial send fails

### OTP Expiration Issues
- Default: 10 minutes for verification
- Default: 24 hours for password reset
- Check server time synchronization

## Future Enhancements

1. SMS-based OTP option
2. Dynamic OTP length configuration
3. Email whitelisting/blacklisting
4. Advanced analytics on email delivery
5. Multi-factor authentication (2FA)

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/accounts/register` | POST | Register new account and send OTP |
| `/accounts/verify-email` | POST | Verify email with OTP token |
| `/accounts/resend-otp` | POST | Resend OTP to email |
| `/accounts/forgot-password` | POST | Initiate password reset |
| `/accounts/reset-password` | POST | Complete password reset with token |

## Related Files
- Backend: `/34TH-STREET-BACKEND/`
- Config: `config.js`, `config.json`, `.env.example`
- Service: `accounts/account.service.js`
- Controller: `accounts/accounts.controller.js`
- Email Helper: `_helpers/send-email.js`
