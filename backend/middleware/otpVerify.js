const OTP = require('../models/OTP');
const logger = require('../utils/logger');
const { otpLimiter } = require('./rateLimiter');

const requireOtpForCms = async (req, res, next) => {
    // We only care about mutations for CMS endpoints
    if (req.method === 'GET') {
        return next();
    }

    const otpCode = req.headers['x-otp-code'];
    const adminEmail = req.user?.email || 'satya.developer@trivastu.com';

    if (!otpCode) {
        return res.status(403).json({ error: 'OTP required to perform this action', requiresCmsOtp: true });
    }

    try {
        // Find the OTP record (any OTP for this email + purpose, regardless of value — check value below)
        const otpRecord = await OTP.findOne({ email: adminEmail, purpose: 'cms-edit' });

        if (!otpRecord) {
            return res.status(401).json({ error: 'OTP not found or expired. Please request a new one.' });
        }

        // Check if locked due to too many wrong attempts
        if (otpRecord.locked) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(429).json({
                error: 'CMS OTP locked after too many incorrect attempts. Please request a new OTP.',
                code: 'OTP_LOCKED',
            });
        }

        // Validate OTP value
        if (otpRecord.otp !== otpCode) {
            otpRecord.attempts += 1;
            if (otpRecord.attempts >= OTP.MAX_ATTEMPTS) {
                otpRecord.locked = true;
                await otpRecord.save();
                logger.warn(`CMS OTP locked for ${adminEmail} after ${OTP.MAX_ATTEMPTS} failed attempts`);
                return res.status(429).json({
                    error: `CMS OTP locked after ${OTP.MAX_ATTEMPTS} incorrect attempts. Please request a new OTP.`,
                    code: 'OTP_LOCKED',
                });
            }
            await otpRecord.save();
            const remaining = OTP.MAX_ATTEMPTS - otpRecord.attempts;
            return res.status(401).json({
                error: 'Invalid OTP',
                attemptsRemaining: remaining,
            });
        }

        // OTP is correct! Consume it.
        await OTP.deleteOne({ _id: otpRecord._id });
        next();
    } catch (error) {
        logger.error('CMS OTP Verification error:', error);
        res.status(500).json({ error: 'Server error during OTP validation' });
    }
};

module.exports = { requireOtpForCms };
