
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { ADMIN_ROLES, ADMIN_ROLE_LABELS, getAdminPermissions } = require('../config/adminAccess');
const {
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
    normalizeIdentifier,
    resolveMaskedTarget,
    serializeLoginEvent
} = require('../utils/adminAuth');

const prisma = require('../utils/prisma');
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const OTP_DEBUG_ENABLED = process.env.NODE_ENV !== 'production' || process.env.ADMIN_OTP_DEBUG === 'true';

function getAttemptWindowStart() {
    return new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);
}

function getTokenExpiry(rememberMe) {
    const expiresInMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    return {
        jwtExpiresIn: rememberMe ? '30d' : '12h',
        expiresAt: new Date(Date.now() + expiresInMs)
    };
}

function getSafeAdminRole(role) {
    return Object.values(ADMIN_ROLES).includes(role) ? role : null;
}

async function findAdminByIdentifier(identifier) {
    return prisma.user.findFirst({
        where: {
            OR: [{ email: identifier }, { phone: identifier }],
            role: 'admin'
        }
    });
}

async function recordLoginAttempt({
    userId = null,
    identifier,
    requestedRole,
    status,
    failureReason = null,
    ipAddress = null,
    locationLabel = null,
    userAgent = null
}) {
    await prisma.adminLoginAttempt.create({
        data: {
            userId,
            identifier,
            requestedRole,
            status,
            failureReason,
            ipAddress,
            locationLabel,
            userAgent
        }
    });
}

async function getRecentFailedAttemptCount(identifier) {
    return prisma.adminLoginAttempt.count({
        where: {
            identifier,
            status: {
                in: ['failed', 'captcha_required', 'blocked']
            },
            createdAt: {
                gte: getAttemptWindowStart()
            }
        }
    });
}

async function createCaptchaChallenge(identifier, requestedRole) {
    const captcha = createCaptchaPrompt();

    return prisma.adminAuthChallenge.create({
        data: {
            identifier,
            requestedRole,
            challengeType: 'captcha',
            prompt: captcha.prompt,
            secretHash: hashSecret(captcha.answer),
            expiresAt: getExpiryDate(CAPTCHA_EXPIRY_MINUTES)
        }
    });
}

async function requireCaptchaIfNeeded({
    identifier,
    requestedRole,
    failedAttempts,
    captchaChallengeId,
    captchaAnswer
}) {
    if (failedAttempts < CAPTCHA_AFTER_FAILURES) {
        return { valid: true, challenge: null };
    }

    if (!captchaChallengeId || !captchaAnswer) {
        const challenge = await createCaptchaChallenge(identifier, requestedRole);
        return { valid: false, challenge };
    }

    const challenge = await prisma.adminAuthChallenge.findFirst({
        where: {
            id: captchaChallengeId,
            identifier,
            requestedRole,
            challengeType: 'captcha',
            consumedAt: null,
            expiresAt: {
                gt: new Date()
            }
        }
    });

    if (!challenge || challenge.secretHash !== hashSecret(String(captchaAnswer).trim())) {
        const nextChallenge = await createCaptchaChallenge(identifier, requestedRole);
        return { valid: false, challenge: nextChallenge };
    }

    await prisma.adminAuthChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() }
    });

    return { valid: true, challenge: null };
}

function buildCaptchaResponse(challenge, failedAttempts) {
    return {
        captchaRequired: true,
        failedAttempts,
        attemptsRemaining: Math.max(BLOCK_AFTER_FAILURES - failedAttempts, 0),
        captcha: {
            challengeId: challenge.id,
            prompt: challenge.prompt,
            expiresAt: challenge.expiresAt
        }
    };
}

async function loginAdmin(req, res) {
    try {
        const {
            identifier,
            password,
            requestedRole,
            deliveryChannel = 'email',
            captchaChallengeId,
            captchaAnswer
        } = req.body;
        const loginContext = req.body.loginContext || {};

        const normalizedIdentifier = normalizeIdentifier(identifier);
        const safeRequestedRole = getSafeAdminRole(requestedRole);
        const safeDeliveryChannel = deliveryChannel === 'whatsapp' ? 'whatsapp' : 'email';
        const ipAddress = getRequestIp(req, loginContext);
        const { locationLabel } = getLocationDetails(loginContext);
        const userAgent = getUserAgent(req);

        if (!normalizedIdentifier || !password || !safeRequestedRole) {
            return res.status(400).json({
                message: 'Identifier, password, and admin role are required.'
            });
        }

        const recentFailedAttempts = await getRecentFailedAttemptCount(normalizedIdentifier);

        if (recentFailedAttempts >= BLOCK_AFTER_FAILURES) {
            await recordLoginAttempt({
                identifier: normalizedIdentifier,
                requestedRole: safeRequestedRole,
                status: 'blocked',
                failureReason: 'attempt_limit_reached',
                ipAddress,
                locationLabel,
                userAgent
            });

            return res.status(429).json({
                message: 'Too many failed login attempts. Please try again later.',
                attemptWindowMinutes: ATTEMPT_WINDOW_MINUTES,
                failedAttempts: recentFailedAttempts,
                attemptsRemaining: 0
            });
        }

        const captchaResult = await requireCaptchaIfNeeded({
            identifier: normalizedIdentifier,
            requestedRole: safeRequestedRole,
            failedAttempts: recentFailedAttempts,
            captchaChallengeId,
            captchaAnswer
        });

        if (!captchaResult.valid) {
            await recordLoginAttempt({
                identifier: normalizedIdentifier,
                requestedRole: safeRequestedRole,
                status: 'captcha_required',
                failureReason: 'captcha_missing_or_invalid',
                ipAddress,
                locationLabel,
                userAgent
            });

            return res.status(403).json({
                message: 'Additional security verification is required.',
                ...buildCaptchaResponse(captchaResult.challenge, recentFailedAttempts)
            });
        }

        const adminUser = await findAdminByIdentifier(normalizedIdentifier);

        if (!adminUser) {
            const failedAttempts = recentFailedAttempts + 1;
            let response = {
                message: 'Incorrect password. Please try again.',
                field: 'password',
                failedAttempts,
                attemptsRemaining: Math.max(BLOCK_AFTER_FAILURES - failedAttempts, 0)
            };

            await recordLoginAttempt({
                identifier: normalizedIdentifier,
                requestedRole: safeRequestedRole,
                status: failedAttempts >= BLOCK_AFTER_FAILURES ? 'blocked' : 'failed',
                failureReason: 'invalid_identifier',
                ipAddress,
                locationLabel,
                userAgent
            });

            if (failedAttempts >= BLOCK_AFTER_FAILURES) {
                response = {
                    ...response,
                    message: 'Too many failed login attempts. Please try again later.'
                };
                return res.status(429).json(response);
            }

            if (failedAttempts >= CAPTCHA_AFTER_FAILURES) {
                const challenge = await createCaptchaChallenge(normalizedIdentifier, safeRequestedRole);
                response = {
                    ...response,
                    ...buildCaptchaResponse(challenge, failedAttempts)
                };
            }

            return res.status(401).json(response);
        }

        if (adminUser.status !== 'active') {
            await recordLoginAttempt({
                userId: adminUser.id,
                identifier: normalizedIdentifier,
                requestedRole: safeRequestedRole,
                status: 'failed',
                failureReason: 'inactive_admin',
                ipAddress,
                locationLabel,
                userAgent
            });

            return res.status(403).json({
                message: 'This admin account is not active.',
                field: 'identifier'
            });
        }

        if ((adminUser.adminRole || ADMIN_ROLES.SUPER_ADMIN) !== safeRequestedRole) {
            await recordLoginAttempt({
                userId: adminUser.id,
                identifier: normalizedIdentifier,
                requestedRole: safeRequestedRole,
                status: 'failed',
                failureReason: 'role_mismatch',
                ipAddress,
                locationLabel,
                userAgent
            });

            return res.status(403).json({
                message: `This account is not assigned to ${ADMIN_ROLE_LABELS[safeRequestedRole]}.`,
                field: 'requestedRole'
            });
        }

        if (safeDeliveryChannel === 'whatsapp' && !adminUser.phone) {
            return res.status(400).json({
                message: 'WhatsApp OTP is unavailable for this admin account.',
                field: 'deliveryChannel'
            });
        }

        const passwordMatches = await bcrypt.compare(password, adminUser.password);

        if (!passwordMatches) {
            const failedAttempts = recentFailedAttempts + 1;

            await recordLoginAttempt({
                userId: adminUser.id,
                identifier: normalizedIdentifier,
                requestedRole: safeRequestedRole,
                status: failedAttempts >= BLOCK_AFTER_FAILURES ? 'blocked' : 'failed',
                failureReason: 'invalid_password',
                ipAddress,
                locationLabel,
                userAgent
            });

            let response = {
                message: 'Incorrect password. Please try again.',
                field: 'password',
                failedAttempts,
                attemptsRemaining: Math.max(BLOCK_AFTER_FAILURES - failedAttempts, 0)
            };

            if (failedAttempts >= BLOCK_AFTER_FAILURES) {
                return res.status(429).json({
                    ...response,
                    message: 'Too many failed login attempts. Please try again later.'
                });
            }

            if (failedAttempts >= CAPTCHA_AFTER_FAILURES) {
                const challenge = await createCaptchaChallenge(normalizedIdentifier, safeRequestedRole);
                response = {
                    ...response,
                    ...buildCaptchaResponse(challenge, failedAttempts)
                };
            }

            return res.status(401).json(response);
        }

        await prisma.adminAuthChallenge.updateMany({
            where: {
                userId: adminUser.id,
                challengeType: 'otp',
                consumedAt: null
            },
            data: {
                consumedAt: new Date()
            }
        });

        const otpCode = createNumericOtp();
        const otpChallenge = await prisma.adminAuthChallenge.create({
            data: {
                userId: adminUser.id,
                identifier: normalizedIdentifier,
                requestedRole: safeRequestedRole,
                challengeType: 'otp',
                deliveryChannel: safeDeliveryChannel,
                secretHash: hashSecret(otpCode),
                maskedTarget: resolveMaskedTarget(adminUser, safeDeliveryChannel),
                expiresAt: getExpiryDate(OTP_EXPIRY_MINUTES)
            }
        });

        await recordLoginAttempt({
            userId: adminUser.id,
            identifier: normalizedIdentifier,
            requestedRole: safeRequestedRole,
            status: 'otp_sent',
            ipAddress,
            locationLabel,
            userAgent
        });

        const previousLogin = await prisma.adminLoginEvent.findFirst({
            where: { userId: adminUser.id },
            orderBy: { createdAt: 'desc' }
        });

        return res.json({
            message: `OTP sent via ${safeDeliveryChannel === 'whatsapp' ? 'WhatsApp' : 'email'}.`,
            requiresOtp: true,
            challengeId: otpChallenge.id,
            expiresAt: otpChallenge.expiresAt,
            maskedTarget: otpChallenge.maskedTarget,
            deliveryChannel: safeDeliveryChannel,
            requestedRole: safeRequestedRole,
            previousLogin: serializeLoginEvent(previousLogin),
            debugOtp: OTP_DEBUG_ENABLED ? otpCode : undefined
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

async function verifyAdminOtp(req, res) {
    try {
        const { challengeId, otpCode, rememberMe = false } = req.body;
        const loginContext = req.body.loginContext || {};

        if (!challengeId || !otpCode) {
            return res.status(400).json({
                message: 'Challenge ID and OTP are required.'
            });
        }

        const otpChallenge = await prisma.adminAuthChallenge.findFirst({
            where: {
                id: challengeId,
                challengeType: 'otp'
            },
            include: {
                user: true
            }
        });

        if (!otpChallenge || !otpChallenge.user) {
            return res.status(400).json({
                message: 'The OTP challenge is invalid.'
            });
        }

        if (otpChallenge.consumedAt) {
            return res.status(400).json({
                message: 'This OTP has already been used.'
            });
        }

        if (otpChallenge.expiresAt <= new Date()) {
            return res.status(400).json({
                message: 'This OTP has expired. Please request a new one.'
            });
        }

        if (otpChallenge.secretHash !== hashSecret(String(otpCode).trim())) {
            return res.status(400).json({
                message: 'The OTP you entered is incorrect.',
                field: 'otpCode'
            });
        }

        const adminUser = otpChallenge.user;
        const ipAddress = getRequestIp(req, loginContext);
        const { city, region, country, locationLabel } = getLocationDetails(loginContext);
        const userAgent = getUserAgent(req);
        const alertMessage = buildAlertMessage(locationLabel);
        const previousLogin = await prisma.adminLoginEvent.findFirst({
            where: { userId: adminUser.id },
            orderBy: { createdAt: 'desc' }
        });

        const currentLogin = await prisma.adminLoginEvent.create({
            data: {
                userId: adminUser.id,
                adminRole: adminUser.adminRole || otpChallenge.requestedRole,
                deliveryChannel: otpChallenge.deliveryChannel,
                ipAddress,
                locationLabel,
                city,
                region,
                country,
                userAgent,
                alertMessage
            }
        });

        await prisma.adminAuthChallenge.update({
            where: { id: otpChallenge.id },
            data: { consumedAt: new Date() }
        });

        await prisma.user.update({
            where: { id: adminUser.id },
            data: {
                lastAdminLoginAt: currentLogin.createdAt
            }
        });

        await prisma.adminLoginAttempt.deleteMany({
            where: {
                identifier: otpChallenge.identifier,
                status: {
                    in: ['failed', 'captcha_required', 'blocked']
                }
            }
        });

        await recordLoginAttempt({
            userId: adminUser.id,
            identifier: otpChallenge.identifier,
            requestedRole: otpChallenge.requestedRole,
            status: 'success',
            ipAddress,
            locationLabel,
            userAgent
        });

        const { jwtExpiresIn, expiresAt } = getTokenExpiry(Boolean(rememberMe));
        const token = jwt.sign(
            {
                userId: adminUser.id,
                role: adminUser.role,
                adminRole: adminUser.adminRole || otpChallenge.requestedRole
            },
            JWT_SECRET,
            { expiresIn: jwtExpiresIn }
        );

        console.info(
            `[ADMIN_LOGIN_ALERT] ${adminUser.email}: ${alertMessage} | IP: ${ipAddress || 'unknown'}`
        );

        // Send Email Alert
        const { sendLoginAlertEmail } = require('../utils/emailService');
        sendLoginAlertEmail(adminUser.email, alertMessage, ipAddress);

        return res.json({
            message: 'Login successful.',
            token,
            expiresAt,
            user: {
                id: adminUser.id,
                name: adminUser.name,
                email: adminUser.email,
                phone: adminUser.phone,
                role: adminUser.role,
                adminRole: adminUser.adminRole || otpChallenge.requestedRole
            },
            permissions: getAdminPermissions(adminUser.adminRole || otpChallenge.requestedRole),
            security: {
                previousLogin: serializeLoginEvent(previousLogin),
                currentLogin: serializeLoginEvent(currentLogin),
                loginAlert: {
                    status: 'logged',
                    message: alertMessage
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

async function changeAdminPassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.admin.userId;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new passwords are required.' });
        }

        const adminUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!adminUser) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, adminUser.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

async function updateAdminProfile(req, res) {
    try {
        const { name, email, phone, image } = req.body;
        const userId = req.admin.userId;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { name, email, phone, image }
        });

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                image: updatedUser.image,
                adminRole: updatedUser.adminRole
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

module.exports = {
    loginAdmin,
    verifyAdminOtp,
    changeAdminPassword,
    updateAdminProfile
};
