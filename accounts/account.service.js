

const config = require('config.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Account = require('./account.model');
const sendEmail = require('_helpers/send-email');
const Token = require('./token.model'); // adjust path if needed
const Role = require('_helpers/role');


function hash(password) {
    return bcrypt.hashSync(password, 10);
}
function generateJwtToken(account) {
    return jwt.sign(
        { sub: account.id, id: account.id },
        config.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    getVerifiedUsers,
    create,
    update,
    delete: _delete
};

async function authenticate({ email, password, ipAddress }) {
    const account = await Account.findOne({ email });

    if (!account || !account.isVerified || !(await bcrypt.compare(password, account.passwordHash))) {
        throw 'Email or password is incorrect';
    }

    // Generate JWT token and refresh token
    const jwtToken = generateJwtToken(account);
    const refreshToken = generateRefreshToken(account, ipAddress);

    // Save refresh token
    await refreshToken.save();

    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}



async function refreshToken({ token, ipAddress }) {
    // implement your refresh logic here if needed
    throw 'Not implemented';
}

async function revokeToken({ token, ipAddress }) {
    // implement your revoke logic here if needed
    throw 'Not implemented';
}

async function register(params, origin) {
  const email = params.email.toLowerCase().trim();
  const existing = await Account.findOne({ email });

  // If already verified -> block re-register
  if (existing && existing.verified) {
    return { account: null, otpSent: false, reason: "ALREADY_VERIFIED" };
  }

  // If exists but not verified -> update details + resend OTP
  let account = existing;

  if (!account) {
    account = new Account({ ...params, email });
    const isFirstAccount = (await Account.countDocuments({})) === 0;
    account.role = isFirstAccount ? Role.Admin : Role.User;
    account.passwordHash = hash(params.password);
  } else {
    // Optional: allow updating name/gender/type while pending verification
    account.firstName = params.firstName;
    account.lastName = params.lastName;
    account.gender = params.gender;
    account.type = params.type;

    // Optional: if they re-register with a new password before verification
    if (params.password) account.passwordHash = hash(params.password);
  }

  // Always generate a fresh OTP
  account.verificationToken = generateResetCode();
  account.verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await account.save();

  // Try to send OTP email (do not fail registration if SMTP fails)
  let otpSent = true;
  try {
    await sendVerificationEmail(account, origin);
  } catch (err) {
    otpSent = false;
    console.error("OTP email failed:", err?.message || err);
  }

  return { account, otpSent, reason: account === existing ? "RESENT" : "CREATED" };
}






async function verifyEmail({ token }) {
  const now = new Date();

  const account = await Account.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: now },
  });

  if (!account) throw 'Verification failed or token expired';

  // ✅ mark verified
  account.verified = now;
  account.verificationToken = undefined;
  account.verificationTokenExpires = undefined;

  await account.save();

  // ✅ Send welcome email once (do NOT block verification if email fails)
  if (!account.welcomeEmailSent) {
    try {
      console.log('📧 Sending welcome email to:', account.email);

      await sendWelcomeEmail(account);

      account.welcomeEmailSent = true;
      await account.save();

      console.log('✅ Welcome email sent + flagged');
    } catch (err) {
      console.error('❌ Welcome email failed:', err?.message || err);
      // don't throw
    }
  }
}






async function forgotPassword({ email }, origin) {
    const account = await Account.findOne({ email });
    if (!account) return;

    // Invalidate any old token
    account.resetToken = undefined;

    // Create new 6-digit code as reset token
    const resetCode = generateResetCode();
    account.resetToken = {
        token: resetCode,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // expires in 24h
    };

    await account.save();

    await sendPasswordResetEmail(account, origin);
}

async function sendWelcomeEmail(account) {
  const name = account.firstName ? ` ${account.firstName}` : '';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#222;">
      <h2 style="color:#581845;">Hi${name} 🎉</h2>

      <p>Welcome to 34th Street.</p>

      <p>You’re officially part of a private, verified community of African professionals from top schools across the globe.</p>

      <p>Take a moment to complete your profile, explore the chat rooms, discover and connect with people from other schools/programs, and join conversations that speak to you.</p>

      <p><em>As we say back home, “the road opens when you begin to walk.”</em></p>

      <p style="margin-top:18px;">Warmly,<br/>See you on the Street!!!</p>

      <hr style="margin:16px 0; border:none; border-top:1px solid #eee;" />

      <p style="font-size: 14px; color:#555;">
        Need help? Visit Support:
        <a href="https://34thstreet.net/app-support/">34thstreet.net/app-support</a>
      </p>
    </div>
  `;

  await sendEmail({
    to: account.email,
    subject: 'Welcome to 34th Street 🎉',
    html,
    // optional but helpful for deliverability:
    text: `Hi${name}! Welcome to 34th Street. Support: https://34thstreet.net/app-support/`,
  });
}




//
async function validateResetToken({ token }) {
    const account = await Account.findOne({ 'resetToken.token': token });
    if (!account || account.resetToken.expires < Date.now()) throw 'Invalid token';
}




async function resetPassword({ token, password }) {
    const account = await Account.findOne({ 'resetToken.token': token });
    if (!account || account.resetToken.expires < Date.now()) throw 'Invalid token';

    account.passwordHash = bcrypt.hashSync(password, 10);
    account.passwordReset = Date.now();
    account.resetToken = undefined;
    await account.save();
}

async function getAll() {
    const accounts = await Account.find();
    return accounts.map(x => basicDetails(x));
}

async function getById(id) {
    const account = await Account.findById(id);
    if (!account) throw 'Account not found';
    return account; // ✅ Return full account data
}

async function getVerifiedUsers() {
    const accounts = await Account.find({ verified: { $ne: null } });
    return accounts.map(x => basicDetails(x));
}
async function create(params) {
    // 👇 Check if email exists
    if (await db.Account.findOne({ email: params.email })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    const account = new Account(params);

    // 👇 Very important: hash the password before saving!
    if (params.password) {
        account.passwordHash = await bcrypt.hash(params.password, 10);
    }

    // 👇 Do not save the raw password
    delete account.password;

    await account.save();

    // Optional: create refresh token, etc.
    return basicDetails(account);
}

async function update(id, params) {
  const account = await Account.findById(id);
  if (!account) throw 'Account not found';

  // Convert stringified interests to array
  if (typeof params.interests === 'string') {
    try {
      params.interests = JSON.parse(params.interests);
    } catch (err) {
      console.error('❌ Failed to parse interests:', err.message);
      params.interests = [];
    }
  }

  // ✅ Whitelist fields that users are allowed to update
  const allowed = [
    'title', 'firstName', 'lastName', 'nickname', 'phone', 'origin',
    'bio', 'interests', 'photos', 'languages', 'fieldOfStudy',
    'graduationYear', 'industry', 'currentRole', 'linkedIn', 'funFact',
    'rship',
    // ✅ location fields
    'currentCity', 'locationUpdatedAt', 'locationSharingEnabled',

  ];

  for (const key of allowed) {
    if (key in params) account[key] = params[key];
  }

  account.updated = new Date();
  await account.save();

  return account; // keep returning full account like you do
}




async function _delete(id) {
    await Account.findByIdAndDelete(id);
}

// ⚙️ Helper Functions



function generateRefreshToken(account, ipAddress) {
    return new Token({
        account: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account) {

    const {
        id, title, firstName, lastName, email, gender, type,
        phone, origin, bio, interests, photos, created, updated, verified,
        nickname, DOB, languages, fieldOfStudy, graduationYear,
        industry, currentRole, linkedIn, funFact, rship, currentCity,
    locationUpdatedAt, locationSharingEnabled,

    } = account;

      const share = locationSharingEnabled !== false;


    return {
        id, title, firstName, lastName, email, gender, type,
        phone, origin, bio, interests, photos, created, updated, verified,
        nickname, DOB, languages, fieldOfStudy, graduationYear,
        industry, currentRole, linkedIn, funFact, rship, currentCity,
    locationUpdatedAt, locationSharingEnabled, 
    currentCity: share ? (currentCity || '') : '',
    locationUpdatedAt: share ? locationUpdatedAt : null,

    };
    
}




async function sendVerificationEmail(account, origin) {
    let message;
    if (origin) {
        const verifyUrl = `${origin}/verify-email?token=${account.verificationToken}`;
        message = `<p>Thanks for registering. Please click the link below to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
    } else {
        message = `<p>Use this token to verify your email: <strong>${account.verificationToken}</strong></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Verify Email',
        html: `<h4>Verify Email</h4>${message}`
    });
}

async function sendPasswordResetEmail(account, origin) {
    let message;
    if (origin) {
        const resetUrl = `${origin}/reset-password?token=${account.resetToken.token}`;
        message = `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
    } else {
        message = `<p>Use this token to reset your password: <strong>${account.resetToken.token}</strong></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Reset Password',
        html: `<h4>Reset Password</h4>${message}`
    });
}


function generateResetCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Generates 6-digit string
}


// const config = require('config.js');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
// const crypto = require('crypto');
// const Account = require('./account.model');
// const sendEmail = require('_helpers/send-email');
// const Token = require('./token.model'); // adjust path if needed
// const Role = require('_helpers/role');


// function hash(password) {
//     return bcrypt.hashSync(password, 10);
// }
// function generateJwtToken(account) {
//     return jwt.sign(
//         { sub: account.id, id: account.id },
//         config.JWT_SECRET,
//         { expiresIn: '7d' }
//     );
// }

// module.exports = {
//     authenticate,
//     refreshToken,
//     revokeToken,
//     register,
//     verifyEmail,
//     forgotPassword,
//     validateResetToken,
//     resetPassword,
//     getAll,
//     getById,
//     getVerifiedUsers,
//     create,
//     update,
//     delete: _delete
// };

// async function authenticate({ email, password, ipAddress }) {
//     const account = await Account.findOne({ email });

//     if (!account || !account.isVerified || !(await bcrypt.compare(password, account.passwordHash))) {
//         throw 'Email or password is incorrect';
//     }

//     // Generate JWT token and refresh token
//     const jwtToken = generateJwtToken(account);
//     const refreshToken = generateRefreshToken(account, ipAddress);

//     // Save refresh token
//     await refreshToken.save();

//     return {
//         ...basicDetails(account),
//         jwtToken,
//         refreshToken: refreshToken.token
//     };
// }



// async function refreshToken({ token, ipAddress }) {
//     // implement your refresh logic here if needed
//     throw 'Not implemented';
// }

// async function revokeToken({ token, ipAddress }) {
//     // implement your revoke logic here if needed
//     throw 'Not implemented';
// }

// async function register(params, origin) {
//     try {
//         const existingUser = await Account.findOne({ email: params.email })
//         if (existingUser) {
//             console.log("User already registered:", params.email);
//             return await sendAlreadyRegisteredEmail(params.email, origin);
//         }

//         const account = new Account(params);
//         const isFirstAccount = (await Account.countDocuments({})) === 0;
//         account.role = isFirstAccount ? Role.Admin : Role.User;

//         //  Generate 6-digit OTP and store it
//         account.verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

//         // Hash password
//         account.passwordHash = hash(params.password);

//         // Save account
//         await account.save();

//         console.log(` User registered successfully: ${account.email}, OTP: ${account.verificationToken}`);

//         // Send verification email with the OTP
//         await sendVerificationEmail(account, origin);

//         //  Return the created user object
//         return account;

//     } catch (error) {
//         console.error(" Error registering user:", error);
//         throw new Error("User registration failed");
//     }

// }


// async function verifyEmail({ token }) {
//     const account = await Account.findOne({ verificationToken: token });
//     if (!account) throw 'Verification failed';
//     account.verified = Date.now();
//     account.verificationToken = undefined;
//     await account.save();
// }



// async function forgotPassword({ email }, origin) {
//     const account = await Account.findOne({ email });
//     if (!account) return;

//     // Invalidate any old token
//     account.resetToken = undefined;

//     // Create new 6-digit code as reset token
//     const resetCode = generateResetCode();
//     account.resetToken = {
//         token: resetCode,
//         expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // expires in 24h
//     };

//     await account.save();

//     await sendPasswordResetEmail(account, origin);
// }




// //
// async function validateResetToken({ token }) {
//     const account = await Account.findOne({ 'resetToken.token': token });
//     if (!account || account.resetToken.expires < Date.now()) throw 'Invalid token';
// }




// async function resetPassword({ token, password }) {
//     const account = await Account.findOne({ 'resetToken.token': token });
//     if (!account || account.resetToken.expires < Date.now()) throw 'Invalid token';

//     account.passwordHash = bcrypt.hashSync(password, 10);
//     account.passwordReset = Date.now();
//     account.resetToken = undefined;
//     await account.save();
// }

// async function getAll() {
//     const accounts = await Account.find();
//     return accounts.map(x => basicDetails(x));
// }

// async function getById(id) {
//     const account = await Account.findById(id);
//     if (!account) throw 'Account not found';
//     return account; // ✅ Return full account data
// }

// async function getVerifiedUsers() {
//     const accounts = await Account.find({ verified: { $ne: null } });
//     return accounts.map(x => basicDetails(x));
// }
// async function create(params) {
//     // 👇 Check if email exists
//     if (await db.Account.findOne({ email: params.email })) {
//         throw 'Email "' + params.email + '" is already registered';
//     }

//     const account = new Account(params);

//     // 👇 Very important: hash the password before saving!
//     if (params.password) {
//         account.passwordHash = await bcrypt.hash(params.password, 10);
//     }

//     // 👇 Do not save the raw password
//     delete account.password;

//     await account.save();

//     // Optional: create refresh token, etc.
//     return basicDetails(account);
// }



// async function update(id, params) {
//     const account = await Account.findById(id);
//     if (!account) throw 'Account not found';

//     // 🧠 Convert stringified interests to array
//     if (typeof params.interests === 'string') {
//         try {
//             params.interests = JSON.parse(params.interests);
//         } catch (err) {
//             console.error('❌ Failed to parse interests:', err.message);
//             params.interests = [];
//         }
//     }

//     // 🔥 Update fields
//     Object.assign(account, {
//         ...params,
//         updated: new Date()
//     });

//     await account.save();

//     return account; // ✅ Return full updated object
// }

// async function _delete(id) {
//     await Account.findByIdAndDelete(id);
// }

// // ⚙️ Helper Functions

// // function generateJwtToken(account) {
// //     return jwt.sign({ id: account.id }, config.JWT_SECRET, { expiresIn: '7d' });
// // }

// function generateRefreshToken(account, ipAddress) {
//     return new Token({
//         account: account.id,
//         token: randomTokenString(),
//         expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//         createdByIp: ipAddress
//     });
// }

// function randomTokenString() {
//     return crypto.randomBytes(40).toString('hex');
// }

// function basicDetails(account) {

//     const {
//         id, title, firstName, lastName, email, gender, type,
//         phone, origin, bio, interests, photos, created, updated, verified,
//         nickname, DOB, languages, fieldOfStudy, graduationYear,
//         industry, currentRole, linkedIn, funFact, rship
//     } = account;

//     return {
//         id, title, firstName, lastName, email, gender, type,
//         phone, origin, bio, interests, photos, created, updated, verified,
//         nickname, DOB, languages, fieldOfStudy, graduationYear,
//         industry, currentRole, linkedIn, funFact, rship
//     };
    
// }




// async function sendVerificationEmail(account, origin) {
//     let message;
//     if (origin) {
//         const verifyUrl = `${origin}/verify-email?token=${account.verificationToken}`;
//         message = `<p>Thanks for registering. Please click the link below to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
//     } else {
//         message = `<p>Use this token to verify your email: <strong>${account.verificationToken}</strong></p>`;
//     }

//     await sendEmail({
//         to: account.email,
//         subject: 'Verify Email',
//         html: `<h4>Verify Email</h4>${message}`
//     });
// }

// async function sendPasswordResetEmail(account, origin) {
//     let message;
//     if (origin) {
//         const resetUrl = `${origin}/reset-password?token=${account.resetToken.token}`;
//         message = `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
//     } else {
//         message = `<p>Use this token to reset your password: <strong>${account.resetToken.token}</strong></p>`;
//     }

//     await sendEmail({
//         to: account.email,
//         subject: 'Reset Password',
//         html: `<h4>Reset Password</h4>${message}`
//     });
// }


// function generateResetCode() {
//     return Math.floor(100000 + Math.random() * 900000).toString(); // Generates 6-digit string
// }