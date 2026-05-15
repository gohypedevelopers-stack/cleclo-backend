const jwt = require('jsonwebtoken');

const { ADMIN_ROLES, isAdminRoleAllowed } = require('../config/adminAccess');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function extractBearerToken(req) {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice('Bearer '.length).trim();
}

function authenticateAdmin(req, res, next) {
    const token = extractBearerToken(req);

    if (!token) {
        return res.status(401).json({ message: 'Authentication required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required.' });
        }

        req.admin = {
            userId: decoded.userId,
            name: decoded.name,
            role: decoded.role,
            adminRole: decoded.adminRole || ADMIN_ROLES.SUPER_ADMIN
        };

        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

function authorizeAdminRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!isAdminRoleAllowed(req.admin.adminRole, allowedRoles)) {
            return res.status(403).json({ message: 'You do not have access to this resource.' });
        }

        return next();
    };
}

module.exports = {
    authenticateAdmin,
    authorizeAdminRoles
};
