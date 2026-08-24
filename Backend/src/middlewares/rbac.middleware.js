const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Role = require('../models/role.model');             // Add this line
const Permission = require('../models/permission.model');

/**
 * Middleware: authenticate
 * Extracts and verifies the JWT Bearer token from the Authorization header.
 * Attaches decoded payload (_id, role) to req.user.
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // 1. Check for Authorization header and Bearer scheme
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Authorization token missing or malformed.'
            });
        }

        // 2. Extract token string
        const token = authHeader.split(' ')[1];

        // 3. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Attach user payload (_id, role) to request object
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Authentication token has expired. Please log in again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token.'
            });
        }

        console.error('Error in authenticate middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication.',
            error: error.message
        });
    }
};

/**
 * Middleware Factory: checkPermission
 * @param {string} requiredModule - Module name (e.g., 'INVENTORY', 'PRODUCTION', 'USERS')
 * @param {string} requiredAction - Action name (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 * 
 * Fetches user from DB, populates role and permissions inside role,
 * and checks if the required module & action exist in the user's role permissions.
 */
const checkPermission = (requiredModule, requiredAction) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?._id || req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required. User payload not found.'
                });
            }

            // 1. Fetch user and heavily populate role and nested permissions
            const user = await User.findById(userId).populate({
                path: 'role',
                populate: {
                    path: 'permissions'
                }
            });

            // 2. Verify user existence and active status
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User account not found.'
                });
            }

            if (!user.isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Account is deactivated.'
                });
            }

            // 3. Verify user has a valid active role
            if (!user.role || !user.role.isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: User is not assigned an active role.'
                });
            }

            // 4. Check if role has matching permission for requiredModule and requiredAction
            const permissions = user.role.permissions || [];
            const hasPermission = permissions.some(perm =>
                perm.module === requiredModule && perm.action === requiredAction
            );

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: `Forbidden: You do not have permission to perform '${requiredAction}' action on '${requiredModule}' module.`
                });
            }

            // Attach populated user details to request object for downstream convenience
            req.userDetails = user;
            next();
        } catch (error) {
            console.error('Error in checkPermission middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during authorization check.',
                error: error.message
            });
        }
    };
};

module.exports = {
    authenticate,
    checkPermission
};
