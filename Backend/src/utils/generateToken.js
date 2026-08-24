const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT token containing user _id, role id, and tenant id.
 * 
 * @param {Object} user - User object containing _id, role, and tenant
 * @returns {string} Signed JWT Token
 */
const generateToken = (user) => {
    const payload = {
        _id: user._id,
        role: user.role,
        tenant: user.tenant || null
    };

    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
};

module.exports = generateToken;
