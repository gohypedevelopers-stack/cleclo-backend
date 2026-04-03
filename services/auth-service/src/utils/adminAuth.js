const crypto = require('crypto');

const OTP_EXPIRY_MINUTES = 10;
const CAPTCHA_EXPIRY_MINUTES = 5;
const CAPTCHA_AFTER_FAILURES = 3;
const BLOCK_AFTER_FAILURES = 5;
const ATTEMPT_WINDOW_MINUTES = 30;

function normalizeIdentifier(identifier = '') {
    const trimmed = String(identifier).trim();
    if (trimmed.includes('@')) {
        return trimmed.toLowerCase();
    }

    return trimmed.replace(/\D/g, '');
}

function hashSecret(secret) {
    return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function createNumericOtp(length = 6) {
    return Array.from({ length }, () => crypto.randomInt(0, 10)).join('');
}

function createCaptchaPrompt() {
    const left = crypto.randomInt(2, 10);
    const right = crypto.randomInt(1, 10);

    return {
        prompt: `Security check: what is ${left} + ${right}?`,
        answer: String(left + right)
    };
}

function maskEmail(email = '') {
    const [localPart = '', domain = ''] = email.split('@');
    if (!localPart || !domain) {
        return email;
    }

    const safeLocal = localPart.length <= 2
        ? `${localPart[0] || '*'}*`
        : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 1))}`;

    return `${safeLocal}@${domain}`;
}

function maskPhone(phone = '') {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length <= 4) {
        return digits;
    }

    return `${'*'.repeat(Math.max(digits.length - 4, 1))}${digits.slice(-4)}`;
}

function resolveMaskedTarget(user, deliveryChannel) {
    if (deliveryChannel === 'whatsapp') {
        return maskPhone(user.phone);
    }

    return maskEmail(user.email);
}

function getExpiryDate(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000);
}

function getRequestIp(req, loginContext = {}) {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        return forwardedFor[0];
    }

    const socketIp = req.socket?.remoteAddress || req.ip || loginContext.ipAddress || null;

    if (!socketIp) {
        return null;
    }

    return String(socketIp).replace(/^::ffff:/, '');
}

function getLocationDetails(loginContext = {}) {
    const city = loginContext.city || null;
    const region = loginContext.region || null;
    const country = loginContext.country || null;
    const locationLabel = loginContext.locationLabel
        || [city, region, country].filter(Boolean).join(', ')
        || loginContext.timezone
        || 'Unknown location';

    return {
        city,
        region,
        country,
        locationLabel
    };
}

function getUserAgent(req) {
    return req.headers['user-agent'] || null;
}

function buildAlertMessage(locationLabel) {
    return locationLabel && locationLabel !== 'Unknown location'
        ? `New login detected from ${locationLabel}`
        : 'New login detected from an unverified location';
}

function serializeLoginEvent(event) {
    if (!event) {
        return null;
    }

    return {
        occurredAt: event.createdAt,
        ipAddress: event.ipAddress,
        locationLabel: event.locationLabel,
        city: event.city,
        region: event.region,
        country: event.country,
        alertMessage: event.alertMessage,
        deliveryChannel: event.deliveryChannel
    };
}

module.exports = {
    ATTEMPT_WINDOW_MINUTES,
    BLOCK_AFTER_FAILURES,
    CAPTCHA_AFTER_FAILURES,
    CAPTCHA_EXPIRY_MINUTES,
    OTP_EXPIRY_MINUTES,
    buildAlertMessage,
    createCaptchaPrompt,
    createNumericOtp,
    getExpiryDate,
    getLocationDetails,
    getRequestIp,
    getUserAgent,
    hashSecret,
    maskEmail,
    maskPhone,
    normalizeIdentifier,
    resolveMaskedTarget,
    serializeLoginEvent
};
