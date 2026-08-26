const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT token containing stringified user _id, role id, and tenant id.
 * 
 * @param {Object} user - User object containing _id, role, and tenant
 * @returns {string} Signed JWT Token
 */
const generateToken = (user) => {
    let tenantId = null;
    if (user.tenant) {
        tenantId = typeof user.tenant === 'object' ? String(user.tenant._id || user.tenant) : String(user.tenant);
    }

    let roleId = null;
    if (user.role) {
        roleId = typeof user.role === 'object' ? String(user.role._id || user.role) : String(user.role);
    }

    const payload = {
        _id: String(user._id),
        role: roleId,
        tenant: tenantId
    };

    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
};

module.exports = generateToken;
