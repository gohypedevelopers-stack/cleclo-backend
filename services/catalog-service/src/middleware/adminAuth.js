const jwt = require('jsonwebtoken');

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
            role: decoded.role,
            adminRole: decoded.adminRole || 'SUPER_ADMIN'
        };

        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

module.exports = {
    authenticateAdmin
};
