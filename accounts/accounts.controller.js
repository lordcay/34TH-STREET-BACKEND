const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const accountService = require('./account.service');
const upload = require('../_middleware/upload');
const jwt = require('jsonwebtoken');
const config = require('../config.json');
const Account = require('./account.model');
const bcrypt = require('bcryptjs');




// routes
router.post('/authenticate', authenticateSchema, authenticate);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.post('/register', registerSchema, register);
router.post('/verify-email', verifyEmailSchema, verifyEmail);
router.post('/forgot-password', forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);
router.get('/', authorize(Role.Admin), getAll);
router.get('/verified', authorize(), getVerifiedUsers);
router.get('/:id', authorize(), getById);


router.post('/', authorize(Role.Admin), createSchema, create);
// router.put('/:id', authorize(), updateSchema, update);
router.put('/:id', authorize(), update);

// router.put('/:id', authorize(), upload.array('photos', 6), update); // no updateSchema here

// router.put('/:id', authorize(), upload.array('photos', 6), updateSchema, update);
router.delete('/:id', authorize(), _delete);

module.exports = router;

// const jwt = require('jsonwebtoken');
// const config = require('../config.jsonon'); // Load config.jsonon

function generateJwtToken(userId) {
    return jwt.sign({ userId: userId }, config.JWT_SECRET, { expiresIn: '7d' });
}
function authenticateSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}
function authenticate(req, res, next) {
    const { email, password } = req.body;
    const ipAddress = req.ip;

    accountService.authenticate({ email, password, ipAddress })
        .then(({ jwtToken, refreshToken, ...account }) => {
            setTokenCookie(res, refreshToken);
            res.json({ ...account, token: jwtToken }); // ✅ Include token
        })
        .catch(next);
}




function refreshToken(req, res, next) {
    const token = req.cookies.refreshToken;
    const ipAddress = req.ip;
    accountService.refreshToken({ token, ipAddress })
        .then(({ refreshToken, ...account }) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

function revokeTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });
    validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
    // accept token from request body or cookie
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;

    if (!token) return res.status(400).json({ message: 'Token is required' });

    // users can revoke their own tokens and admins can revoke any tokens
    if (!req.user.ownsToken(token) && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

function registerSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        gender: Joi.string().valid('Male', 'Female', 'Non-binary').required(),

        // location: Joi.string().required(),
        type: Joi.string().required(),  // ✅ Required type field
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')),
    });
    validateRequest(req, next, schema);
}



// function register(req, res, next) {
//     accountService.register(req.body, req.get('origin'))
//         .then(user => {
//             if (!user) {
//                 console.error("User registration failed - no user returned");
//                 return res.status(400).json({ message: "User registration failed" });
//             }

//             // Generate JWT token after successful registration
//             const token = generateJwtToken(user.id);

//             res.json({
//                 message: "Registration successful, please check your email for verification instructions",
//                 token: token,
//                 userId: user.id
//             });
//         })
//         .catch(error => {
//             console.error("User registration error:", error);
//             res.status(500).json({ message: "User registration failed", error: error.toString() });
//         });
// }


function register(req, res, next) {
    accountService.register(req.body, req.get('origin'))
        .then(user => {
            if (!user) {
                console.error("User registration failed - no user returned");
                return res.status(400).json({ message: "User registration failed" });
            }

            // Generate JWT token after successful registration
            const token = generateJwtToken(user);

            res.json({
                message: "Registration successful, please check your email for verification instructions",
                token: token,
                userId: user.id
            });
        })
        .catch(error => {
            console.error("User registration error:", error);
            res.status(500).json({ message: "User registration failed", error: error.toString() });
        });
}






function verifyEmailSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function verifyEmail(req, res, next) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful, you can now login' }))
        .catch(next);
}



function getVerifiedUsers(req, res, next) {
    const currentUserId = req.user.id; // 🔐 comes from JWT authorize middleware

    accountService.getVerifiedUsers()
        .then(users => {
            // 🧼 filter out the logged-in user
            const filteredUsers = users.filter(user => user.id !== currentUserId);
            res.json(filteredUsers);
        })
        .catch(next);
}


function forgotPasswordSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });
    validateRequest(req, next, schema);
}

function forgotPassword(req, res, next) {
    accountService.forgotPassword(req.body, req.get('origin'))
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}

function validateResetTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function validateResetToken(req, res, next) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

function resetPasswordSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

function resetPassword(req, res, next) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

function getAll(req, res, next) {
    accountService.getAll()
        .then(accounts => res.json(accounts))
        .catch(next);
}

function getById(req, res, next) {
    // users can get their own account and admins can get any account
    if (req.params.id !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    accountService.getById(req.params.id)
        .then(account => account ? res.json({ user: account }) : res.sendStatus(404))  // ✅ wrap it!
        .catch(next);


}

function createSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        type: Joi.string().type().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        role: Joi.string().valid(Role.Admin, Role.User).required()
    });
    validateRequest(req, next, schema);
}

function create(req, res, next) {
    accountService.create(req.body)
        .then(account => res.json(account))
        .catch(next);
}

function updateSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().empty(''),
        title: Joi.string().empty(''),
        firstName: Joi.string().empty(''),
        lastName: Joi.string().empty(''),
        password: Joi.string().min(6).empty(''),
        confirmPassword: Joi.string().valid(Joi.ref('password')).empty(''),
        gender: Joi.string().valid('Male', 'Female', 'Non-binary').empty(''),
        type: Joi.string().empty(''),
        bio: Joi.string().allow('', null),
        graduationYear: Joi.string().allow('', null),
        fieldOfStudy: Joi.string().allow('', null),
        currentRole: Joi.string().allow('', null),
        industry: Joi.string().allow('', null),
        linkedIn: Joi.string().uri().allow('', null),
        funFact: Joi.string().allow('', null),
        rship: Joi.string().valid('Single', 'Married', 'Dating', 'It’s complicated', 'Prefer not to say').allow('', null),
        phone: Joi.string().allow('', null),
        origin: Joi.string().allow('', null),
        nickname: Joi.string().allow('', null),
        DOB: Joi.date().allow(null),
        languages: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
        interests: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
        photos: Joi.array().items(Joi.string()).optional()
    }).with('password', 'confirmPassword');

    validateRequest(req, next, schema);
}


// Validation schema
// function updateSchema(req, res, next) {
//     const schema = Joi.object({
//         email: Joi.string().email().empty(''),
//         title: Joi.string().empty(''),
//         firstName: Joi.string().empty(''),
//         lastName: Joi.string().empty(''),
//         password: Joi.string().min(6).empty(''),
//         confirmPassword: Joi.string().valid(Joi.ref('password')).empty(''),
//         gender: Joi.string().valid('Male', 'Female', 'Other').empty(''),
//         location: Joi.string().empty(''),
//         type: Joi.string().empty(''),
//         bio: Joi.string().allow('', null),
//         graduationYear: Joi.string().allow('', null),
//         degree: Joi.string().allow('', null),
//         photos: Joi.array().items(Joi.string()).optional()
//     }).with('password', 'confirmPassword');

//     validateRequest(req, next, schema);
// }

function update(req, res, next) {
    if (req.params.id !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.body.interests && typeof req.body.interests === 'string') {
        try {
            req.body.interests = JSON.parse(req.body.interests);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid interests format' });
        }
    }

    accountService.update(req.params.id, req.body)
        .then(account => res.json({ user: account }))
        .catch(next);
}


// function update(req, res, next) {
//     if (req.params.id !== req.user.id && req.user.role !== Role.Admin) {
//         return res.status(401).json({ message: 'Unauthorized' });
//     }

//     // 👇 Confirm incoming body and files
//     console.log('🛠 Incoming update body:', req.body);
//     // console.log('📸 Uploaded photos:', req.files);

//     // Add photo paths if files are uploaded
//     // if (req.files && req.files.length > 0) {
//     //     const photoPaths = req.files.map(file => `/uploads/${file.filename}`);
//     //     req.body.photos = photoPaths;
//     // }

//     // 🔍 Manually parse and validate interests if sent as stringified JSON
//     if (req.body.interests && typeof req.body.interests === 'string') {
//         try {
//             req.body.interests = JSON.parse(req.body.interests);
//         } catch (err) {
//             return res.status(400).json({ message: 'Invalid interests format' });
//         }
//     }

//     // Skip Joi validation for now — can be added later once body parsing works

//     accountService.update(req.params.id, req.body)
//         .then(account => res.json({ user: account })) // ✅ send user object for frontend
//         .catch(next);
// }



function _delete(req, res, next) {
    // users can delete their own account and admins can delete any account
    if (req.params.id !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}

// helper functions

function randomTokenString() {
    const crypto = require('crypto');
    return crypto.randomBytes(40).toString('hex');
}

function setTokenCookie(res, token) {
    // create cookie with refresh token that expires in 7 days
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    res.cookie('refreshToken', token, cookieOptions);
}



