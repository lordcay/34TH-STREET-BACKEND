// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const schema = new Schema({
//     email: { type: String, unique: true, required: true },
//     passwordHash: { type: String, required: true },
//     title: { type: String,  },
//     firstName: { type: String, required: true },
//     lastName: { type: String, required: true },
//     gender: { type: String, required: true },
//     // birth: { type: String, required: true },
//     // location: { type: String, required: true },
//     type: { type: String, required: true },
//     // photos: [String],  // Array of image URLs or paths


//         // ✅ Newly added fields
//     phone: { type: String },
//     origin: { type: String },
//     bio: { type: String, maxlength: 700 },
//     interests: [{ type: String }],
//     photos: [String],  // Already exists
//     // acceptTerms: Boolean,
//     // role: { type: String, required: true },
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

// schema.virtual('isVerified').get(function () {
//     return !!(this.verified || this.passwordReset);
// });

// schema.set('toJSON', {
//     virtuals: true,
//     versionKey: false,
//     transform: function (doc, ret) {
//         // remove these props when object is serialized
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

    phone: { type: String },
    origin: { type: String },
    bio: { type: String, maxlength: 700 },
    interests: [{ type: String }],
    photos: [String],

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

// ✅ Ensure isVerified works during login
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
