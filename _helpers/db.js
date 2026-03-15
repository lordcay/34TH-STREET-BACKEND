


// const config = require('config.js');
// const mongoose = require('mongoose');

// mongoose.connect(process.env.MONGODB_URI || config.connectionString);
// mongoose.Promise = global.Promise;

// // mongoose.connect(process.env.MONGODB_URI || config.connectionString);
// // mongoose.Promise = global.Promise;

// module.exports = {
//     Account: require('../accounts/account.model'),          // ✅ FIXED
//     RefreshToken: require('../accounts/refresh-token.model'), // ✅ FIXED
//     Message: require('../messages/message.model'),            // ✅ FIXED
//     isValidId
    
// };

// function isValidId(id) {
//     return mongoose.Types.ObjectId.isValid(id);
// }





const config = require('config.js');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || config.connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.Promise = global.Promise;

module.exports = {
  // Accounts
  Account: require('../accounts/account.model'),
  RefreshToken: require('../accounts/refresh-token.model'),

  // Direct messages
  Message: require('../messages/message.model'),

  // 🔥 Feed (Daily Gist)
  Feed: require('../feed/feed.model'),
  FeedVote: require('../feed/feedVote.model'),
  FeedComment: require('../feed/feedComment.model'),

  // 🤝 Connections
  Connection: require('../connections/connection.model'),

  // Utils
  isValidId
};

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}
console.log("✅ DB URI:", process.env.MONGODB_URI || config.connectionString);
