


// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const schema = new Schema({
//     email: { type: String, unique: true, required: true },
//     passwordHash: { type: String, required: true },
//     title: { type: String },
//     firstName: { type: String, required: true },
//     lastName: { type: String, required: true },
//     gender: { type: String, required: true },
//     type: { type: String, required: true },

//     phone: { type: String },
//     origin: { type: String },
//     bio: { type: String, maxlength: 700 },
//     interests: [{ type: String }],
//     photos: [String],

//     verificationToken: String,
//     verified: Date,
//     resetToken: {
//         token: String,
//         expires: Date
//     },
//     passwordReset: Date,
//     created: { type: Date, default: Date.now },
//     updated: Date
// });

// // ✅ Ensure isVerified works during login
// schema.virtual('isVerified').get(function () {
//     return !!(this.verified || this.passwordReset);
// });

// schema.set('toJSON', {
//     virtuals: true,
//     versionKey: false,
//     transform: function (doc, ret) {
//         delete ret._id;
//         delete ret.passwordHash;
//     }
// });

// module.exports = mongoose.model('Account', schema);


const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    title: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    gender: { type: String, required: true },
    type: { type: String, required: true },

    // New Fields
    nickname: { type: String },
    DOB: { type: Date },
    phone: { type: String },
    origin: { type: String },
    bio: { type: String, maxlength: 700 },
    interests: [{ type: String }],
    photos: [String],
    languages: [{ type: String }],
    fieldOfStudy: { type: String },
    graduationYear: { type: String },
    industry: { type: String },
    currentRole: { type: String },
    linkedIn: { type: String },
    funFact: { type: String },
    rship: { type: String },

    verificationToken: String,
    verified: Date,
    resetToken: {
        token: String,
        expires: Date
    },
    passwordReset: Date,
    created: { type: Date, default: Date.now },
    updated: Date
});

schema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        delete ret.passwordHash;
    }
});

module.exports = mongoose.model('Account', schema);
