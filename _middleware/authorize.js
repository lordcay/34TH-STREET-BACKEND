//  const jwt = require('express-jwt');

// const config = require('config.js');
// const db = require('_helpers/db');

// module.exports = authorize;

// function authorize(roles = []) {
//   if (typeof roles === 'string') roles = [roles];

//   return [
//     // skip preflight
//     jwt({ secret: config.JWT_SECRET, algorithms: ['HS256'] })
//       .unless({ method: ['OPTIONS'] }),

//     async (req, res, next) => {
//       try {
//         if (req.method === 'OPTIONS') return next();

//         // ✅ works for both old + new express-jwt
//         const userId =
//           req.user?.id ||
//           req.auth?.id ||
//           req.auth?.sub ||
//           req.user?.sub;

//         console.log("🧾 Token payload:", req.auth || req.user);
//         console.log("🆔 Using userId:", userId);

//         if (!userId) {
//           return res.status(401).json({ message: 'Unauthorized: Missing token payload id' });
//         }

//         const account = await db.Account.findById(userId);
//         console.log("👤 Account full:", account);
// console.log("👤 Account role:", account?.role);

//         if (!account) {
//           return res.status(401).json({ message: 'Unauthorized: User not found' });
//         }

//         console.log("👤 Account role:", account.role);

//         if (roles.length && !roles.includes(account.role)) {
//           return res.status(403).json({ message: 'Forbidden: Role not authorized' });
//         }

//         // attach for downstream
//         req.user = req.user || {};
//         req.user.id = String(userId);          // ✅ SET ID

//         req.user.role = account.role;

//         next();
//       } catch (err) {
//         console.error("⚠️ authorize error:", err);
//         return res.status(401).json({ message: 'Unauthorized' });
//       }
//     }
//   ];
// }



const jwt = require('express-jwt');
const config = require('config.js');
const db = require('_helpers/db');

module.exports = authorize;

function authorize(roles = []) {
  if (typeof roles === 'string') roles = [roles];

  return [
    // ✅ Validate JWT (skip OPTIONS preflight)
    jwt({ secret: config.JWT_SECRET, algorithms: ['HS256'] })
      .unless({ method: ['OPTIONS'] }),

    async (req, res, next) => {
      try {
        if (req.method === 'OPTIONS') return next();

        // ✅ express-jwt may attach payload to req.auth (new) or req.user (older)
        const payload = req.auth || req.user;

        // ✅ Your token includes { id, sub }, so prefer id then sub
        const userId = payload?.id || payload?.sub;

        console.log('🧾 Token payload:', payload);
        console.log('🆔 Using userId:', userId);

        if (!userId) {
          return res
            .status(401)
            .json({ message: 'Unauthorized: Missing token payload id' });
        }

        const account = await db.Account.findById(userId);

        if (!account) {
          return res.status(401).json({ message: 'Unauthorized: User not found' });
        }

        if (roles.length && !roles.includes(account.role)) {
          return res.status(403).json({ message: 'Forbidden: Role not authorized' });
        }

        // ✅ Attach for downstream controllers
        // Always ensure req.user exists, and set id + role for your controllers
        req.user = req.user || {};
        req.user.id = String(account.id);      // ✅ IMPORTANT: set id consistently
        req.user.role = account.role;

        next();
      } catch (err) {
        console.error('⚠️ authorize error:', err);
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }
  ];
}
