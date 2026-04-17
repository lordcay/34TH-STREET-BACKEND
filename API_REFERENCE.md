# 34th Street Backend - API Reference

## Authentication & Account Endpoints

### 1. Register User
**Endpoint:** `POST /accounts/register`

**Request:**
```json
{
  "email": "user@school.edu",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "gender": "Male",
  "type": "MBA"
}
```

**Response (201 Created):**
```json
{
  "message": "Account created. Verify OTP to continue.",
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@school.edu",
  "otpSent": true,
  "status": "PENDING_VERIFICATION"
}
```

**Error Cases:**
- Email already registered and verified → 409 Conflict
- Invalid email format → 400 Bad Request
- Missing required fields → 400 Bad Request

---

### 2. Verify Email (Confirm OTP)
**Endpoint:** `POST /accounts/verify-email`

**Request:**
```json
{
  "token": "123456"
}
```

**Response (200 OK):**
```json
{
  "message": "Verification successful, you can now login"
}
```

**Notes:**
- OTP is valid for 10 minutes
- Server returns JWT token on successful verification
- Welcome email sent async (won't block response)

---

### 3. Resend OTP (NEW)
**Endpoint:** `POST /accounts/resend-otp`

**Request:**
```json
{
  "email": "user@school.edu"
}
```

**Response (200 OK):**
```json
{
  "message": "OTP sent successfully",
  "email": "user@school.edu",
  "otpSent": true
}
```

**Rate Limiting:**
- Minimum 30 seconds between requests
- Error if requested too soon:
```json
{
  "message": "Please wait 25 seconds before requesting another OTP"
}
```

---

### 4. Authenticate (Login)
**Endpoint:** `POST /accounts/authenticate`

**Request:**
```json
{
  "email": "user@school.edu",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "firstName": "John",
  "lastName": "Doe",
  "email": "user@school.edu",
  "gender": "Male",
  "type": "MBA",
  "verified": "2024-01-15T10:30:00Z",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "7f7cb6f7-3c1e-4d8e-b5f3-...",
  "role": "user"
}
```

**Error Cases:**
- Email not verified → 401 Unauthorized
- Wrong password → 401 Unauthorized
- Email doesn't exist → 401 Unauthorized

---

### 5. Forgot Password
**Endpoint:** `POST /accounts/forgot-password`

**Request:**
```json
{
  "email": "user@school.edu"
}
```

**Response (200 OK):**
```json
{
  "message": "If email exists, a reset link has been sent",
  "success": true
}
```

**Security Note:**
- Response is same whether email exists or not (prevents email enumeration)
- Reset code valid for 24 hours
- Email sent with retry logic

---

### 6. Validate Reset Token
**Endpoint:** `POST /accounts/validate-reset-token`

**Request:**
```json
{
  "token": "123456"
}
```

**Response (200 OK):**
```json
{
  "message": "Token is valid"
}
```

**Error Cases:**
- Invalid or expired token → 400 Bad Request

---

### 7. Reset Password
**Endpoint:** `POST /accounts/reset-password`

**Request:**
```json
{
  "token": "123456",
  "password": "NewSecurePassword123",
  "confirmPassword": "NewSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successful, you can now login"
}
```

**Validation:**
- Password minimum 6 characters
- Passwords must match
- Token must be valid and not expired

---

### 8. Get Verified Users
**Endpoint:** `GET /accounts/verified`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
```
?sortByDistance=true  // Optional: sort by user location
```

**Response (200 OK):**
```json
[
  {
    "id": "507f1f77bcf86cd799439012",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@school.edu",
    "gender": "Female",
    "type": "MBA",
    "verified": "2024-01-15T10:30:00Z",
    "bio": "Passionate about innovation",
    "interests": ["Tech", "Startups"],
    "currentCity": "New York",
    "distance": 2.5
  }
]
```

---

### 9. Get User by ID
**Endpoint:** `GET /accounts/:id`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439012",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@school.edu",
    "gender": "Female",
    "type": "MBA",
    "verified": "2024-01-15T10:30:00Z",
    "bio": "Passionate about innovation",
    "interests": ["Tech", "Startups"],
    "currentCity": "New York"
  }
}
```

---

### 10. Update Account
**Endpoint:** `PUT /accounts/:id`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "bio": "Updated bio",
  "interests": ["Tech", "Startups", "AI"],
  "linkedIn": "https://linkedin.com/...",
  "currentCity": "San Francisco"
}
```

**Response (200 OK):**
```json
{
  /* Updated account object */
}
```

**Allowed Fields:**
```
title, firstName, lastName, nickname, phone, origin,
bio, interests, photos, languages, fieldOfStudy,
graduationYear, industry, currentRole, linkedIn, funFact,
rship, currentCity, locationUpdatedAt, locationSharingEnabled
```

---

### 11. Save Push Token
**Endpoint:** `POST /accounts/push-token`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request:**
```json
{
  "expoPushToken": "ExponentPushToken[...]"
}
```

**Response (200 OK):**
```json
{
  "message": "✅ Push token saved!"
}
```

---

## Common Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Query successful, token valid |
| 201 | Created | New account registered |
| 400 | Bad Request | Invalid email, missing fields |
| 401 | Unauthorized | Wrong password, missing token |
| 404 | Not Found | User ID doesn't exist |
| 409 | Conflict | Email already verified |
| 500 | Server Error | Database error, SMTP error |

---

## Error Response Format

All errors follow this format:

```json
{
  "message": "Error description"
}
```

Examples:
```json
{
  "message": "Email or password is incorrect"
}
```

```json
{
  "message": "Verification failed or token expired"
}
```

```json
{
  "message": "Please wait 25 seconds before requesting another OTP"
}
```

---

## Authentication Strategy

1. **Register** → Get verified via OTP → Receive JWT token
2. **Login** → Provide credentials → Receive JWT token
3. **Use** → Send JWT in `Authorization: Bearer <token>` header
4. **Protected Routes** → All endpoints requiring auth need JWT

---

## OTP & Reset Code Format

- **Format:** 6-digit numeric string (000000-999999)
- **Sent via:** Email with retry logic
- **Expiration:** 10 minutes (OTP), 24 hours (Reset)
- **Validation:** Must match and not be expired

---

## Email Service Details

### Sending Features
- ✅ Automatic retry on failure (exponential backoff)
- ✅ Professional HTML templates
- ✅ Plain text fallback
- ✅ Comprehensive error logging

### Retry Logic
- Attempt 1: Immediate
- Attempt 2: Wait 1 second, retry
- Attempt 3: Wait 2 seconds, retry
- Max attempts: 3

### Email Types
1. **Verification Email** - Contains 6-digit OTP
2. **Welcome Email** - Sent after successful verification
3. **Password Reset Email** - Contains 6-digit reset code

---

## Rate Limiting

### OTP Resend
- Minimum gap: 30 seconds
- Error message when limit exceeded:
```json
{
  "message": "Please wait 15 seconds before requesting another OTP"
}
```

---

## Mobile App Integration

### Registration Flow
1. User fills registration form (email, password, name, gender, type)
2. Call `POST /accounts/register`
3. Store `userId` from response
4. Navigate to OTP verification screen
5. User enters 6-digit code
6. Call `POST /accounts/verify-email` with token
7. Store returned JWT token in secure storage
8. Navigate to profile completion or home screen

### Resend OTP
- User clicks "Resend OTP" button
- Call `POST /accounts/resend-otp` with email
- Handle rate limiting error gracefully
- Show user how many seconds to wait

### Forgot Password
1. User navigates to forgot password screen
2. Enters email address
3. Call `POST /accounts/forgot-password`
4. Show message to check email
5. User enters 6-digit code
6. Call `POST /accounts/validate-reset-token` (optional validation)
7. Call `POST /accounts/reset-password` with new password
8. Redirect to login

---

## Environment Variables Required

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key

EMAIL_FROM=noreply@34thstreet.net
CONNECTION_STRING=mongodb_connection_url
JWT_SECRET=your_secret_key
```

---

## Testing Commands

### Test with cURL

**Register:**
```bash
curl -X POST http://localhost:4000/accounts/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123",
    "firstName": "John",
    "lastName": "Doe",
    "gender": "Male",
    "type": "MBA"
  }'
```

**Resend OTP:**
```bash
curl -X POST http://localhost:4000/accounts/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Verify Email:**
```bash
curl -X POST http://localhost:4000/accounts/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "123456"}'
```

---

## Support & Documentation

- Technical Details: See `OTP_EMAIL_SYSTEM.md`
- Implementation Notes: See `IMPLEMENTATION_SUMMARY.md`
- Environment Setup: See `.env.example`
