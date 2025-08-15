

const jwt = require('express-jwt');
const config = require('config.json');
const db = require('_helpers/db');

module.exports = authorize;

function authorize(roles = []) {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return [
        // ✅ Fix: use correct config key for JWT secret
        jwt({ secret: config.JWT_SECRET, algorithms: ['HS256'] }),

        async (req, res, next) => {
            try {
                console.log("🔍 Checking Authorization...");
                console.log("🔑 Received Token:", req.headers.authorization);

                const account = await db.Account.findById(req.user.id);
                console.log("👤 Retrieved Account:", account);

                if (!account) {
                    console.log("❌ No account found, rejecting request.");
                    return res.status(401).json({ message: 'Unauthorized: User not found' });
                }

                const refreshTokens = await db.RefreshToken.find({ account: account.id });
                console.log("🔄 Refresh Tokens Found:", refreshTokens.length);

                if (roles.length && !roles.includes(account.role)) {
                    console.log("🚫 User Role Not Authorized:", account.role);
                    return res.status(403).json({ message: 'Forbidden: Role not authorized' });
                }

                req.user.role = account.role;
                req.user.ownsToken = token => !!refreshTokens.find(x => x.token === token);

                console.log("✅ Authorization Success");
                next();
            } catch (error) {
                console.error("⚠️ Error in Authorization Middleware:", error);
                return res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    ];
}
