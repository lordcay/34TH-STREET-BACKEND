

// const config = require('config.json');
// const mongoose = require('mongoose');

// mongoose.connect(process.env.MONGODB_URI || config.connectionString);
// mongoose.Promise = global.Promise;

// module.exports = {
//     Account: require('accounts/account.model'),
//     RefreshToken: require('accounts/refresh-token.model'),
//     Message: require('messages/message.model'), // ✅ Add this line

//     isValidId
// };

// function isValidId(id) {
//     return mongoose.Types.ObjectId.isValid(id);
// }


const config = require('config.json');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || config.connectionString);
mongoose.Promise = global.Promise;

module.exports = {
    Account: require('../accounts/account.model'),          // ✅ FIXED
    RefreshToken: require('../accounts/refresh-token.model'), // ✅ FIXED
    Message: require('../messages/message.model'),            // ✅ FIXED
    isValidId
};

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}
