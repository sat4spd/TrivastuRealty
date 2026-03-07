const OTP = require('../models/OTP');
const logger = require('../utils/logger');

const requireOtpForCms = async (req, res, next) => {
    // We only care about mutations for CMS endpoints
    if (req.method === 'GET') {
        return next();
    }

    const otpCode = req.headers['x-otp-code'];

    // For now, assume admin is making the change, so we verify against the admin email
    // If you support multiple admins in the future, extract the email from req.user
    const adminEmail = req.user?.email || 'satya.developer@trivastu.com'; // Fallback if no user object exists

    if (!otpCode) {
        return res.status(403).json({ error: 'OTP required to perform this action', requiresCmsOtp: true });
    }

    try {
        const validOtp = await OTP.findOne({ email: adminEmail, otp: otpCode, purpose: 'cms-edit' });

        if (!validOtp) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        // OTP is correct! Consume it.
        await OTP.deleteOne({ _id: validOtp._id });
        next();
    } catch (error) {
        logger.error('CMS OTP Verification error:', error);
        res.status(500).json({ error: 'Server error during OTP validation' });
    }
};

module.exports = { requireOtpForCms };
