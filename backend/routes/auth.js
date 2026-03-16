const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { otpLimiter, loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const OTP = require('../models/OTP');
const whatsappService = require('../services/whatsappService');
const nodemailer = require('nodemailer');

// Helper to send email fallback
const sendEmailFallback = async (otpCode) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: false, // true for 465, false for other ports
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        await transporter.sendMail({
            from: `\"Trivastu Security\" <${process.env.EMAIL_FROM}>`,
            to: "info@trivastu.com", // Fallback admin email
            subject: "Your Trivastu Admin OTP Code",
            text: `Your Trivastu Realty secure OTP code is: ${otpCode}. It will expire in 5 minutes. Do not share this with anyone.`
        });
        logger.info('OTP email fallback sent successfully');
    } catch (e) {
        logger.error('Failed to send OTP email fallback:', e);
    }
};

// POST /api/auth/login - Step 1: Validate Password & Issue OTP
// Protected by loginLimiter: max 10 attempts per 15 min (per IP+email)
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const user = await User.findOne({ email, role: 'admin' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        if (!user.passwordHash) {
            user.passwordHash = await bcrypt.hash(password, 10);
            await user.save();
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to DB (expires in 5 mins due to index) — clear old ones first
        await OTP.deleteMany({ email: user.email, purpose: 'login' });
        await OTP.create({ email: user.email, otp: otpCode, purpose: 'login', attempts: 0, locked: false });

        // Try sending via WhatsApp to Admin Number
        const adminPhone = '+918105180539';
        const msg = `🔐 *Trivastu Admin Security*\n\nYour login verification code is: *${otpCode}*\n\n_This code will expire in 5 minutes._`;

        try {
            await whatsappService.sendTextMessage(adminPhone, msg);
            logger.info('OTP Sent via WhatsApp to admin');
        } catch (waErr) {
            logger.error('WhatsApp OTP failed, attempting email fallback', waErr);
            await sendEmailFallback(otpCode);
        }

        // Return requiresOtp flag instead of JWT
        res.json({ requiresOtp: true, message: 'OTP sent to registered WhatsApp/Email. Valid for 5 minutes.' });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/verify-login - Step 2: Validate OTP & Issue JWT
// Protected by otpLimiter: max 5 attempts per 15 min (per IP+email)
router.post('/verify-login', otpLimiter, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

        // Find unexpired, unlocked OTP record
        const otpRecord = await OTP.findOne({ email, purpose: 'login' });

        if (!otpRecord) {
            return res.status(401).json({ error: 'OTP not found or expired. Please request a new one.' });
        }

        // Check if locked due to too many wrong attempts
        if (otpRecord.locked) {
            await OTP.deleteOne({ _id: otpRecord._id }); // force re-request
            return res.status(429).json({
                error: 'OTP locked after too many incorrect attempts. Please request a new OTP.',
                code: 'OTP_LOCKED',
            });
        }

        // Check if OTP matches
        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            if (otpRecord.attempts >= OTP.MAX_ATTEMPTS) {
                otpRecord.locked = true;
                await otpRecord.save();
                logger.warn(`OTP locked for ${email} after ${OTP.MAX_ATTEMPTS} failed attempts`);
                return res.status(429).json({
                    error: `OTP locked after ${OTP.MAX_ATTEMPTS} incorrect attempts. Please request a new OTP.`,
                    code: 'OTP_LOCKED',
                    attemptsUsed: otpRecord.attempts,
                });
            }
            await otpRecord.save();
            const remaining = OTP.MAX_ATTEMPTS - otpRecord.attempts;
            return res.status(401).json({
                error: 'Invalid OTP',
                attemptsRemaining: remaining,
            });
        }

        const user = await User.findOne({ email, role: 'admin' });
        if (!user) return res.status(401).json({ error: 'User not found' });

        // Consume OTP
        await OTP.deleteOne({ _id: otpRecord._id });

        // Issue JWT
        const token = generateToken(user._id);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });

    } catch (error) {
        logger.error('OTP Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// POST /api/auth/resend-otp - Step 1b: Resend Login OTP
// Protected by loginLimiter to prevent OTP flooding
router.post('/resend-otp', loginLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const user = await User.findOne({ email, role: 'admin' });
        if (!user) return res.status(401).json({ error: 'Invalid user' });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.deleteMany({ email: user.email, purpose: 'login' });
        await OTP.create({ email: user.email, otp: otpCode, purpose: 'login', attempts: 0, locked: false });

        const adminPhone = '+918105180539';
        const msg = `🔐 *Trivastu Admin Security*\n\nYour requested login verification code is: *${otpCode}*\n\n_This code will expire in 5 minutes._`;

        try {
            await whatsappService.sendTextMessage(adminPhone, msg);
        } catch (waErr) {
            await sendEmailFallback(otpCode);
        }

        res.json({ message: 'OTP resent successfully.' });
    } catch (error) {
        logger.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Resend failed' });
    }
});

// POST /api/auth/request-cms-otp - Step 1c: Request OTP for CMS mutations
// Protected by otpLimiter
router.post('/request-cms-otp', otpLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const user = await User.findOne({ email, role: 'admin' });
        if (!user) return res.status(401).json({ error: 'Unauthorized to edit CMS' });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.deleteMany({ email: user.email, purpose: 'cms-edit' });
        await OTP.create({ email: user.email, otp: otpCode, purpose: 'cms-edit', attempts: 0, locked: false });

        const adminPhone = '+918105180539';
        const msg = `⚠️ *Trivastu CMS Alert*\n\nYou are attempting to modify website content.\nYour authorization code is: *${otpCode}*\n\n_Expires in 5 minutes._`;

        try {
            await whatsappService.sendTextMessage(adminPhone, msg);
        } catch (waErr) {
            await sendEmailFallback(otpCode);
        }

        res.json({ message: 'CMS OTP sent successfully.' });
    } catch (error) {
        logger.error('Request CMS OTP error:', error);
        res.status(500).json({ error: 'Failed to generate OTP' });
    }
});

router.post('/setup', async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin && existingAdmin.passwordHash) {
            return res.status(400).json({ error: 'Admin already configured' });
        }

        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        let admin = existingAdmin || new User();
        admin.email = email;
        admin.name = name || 'Admin';
        admin.role = 'admin';
        admin.phone = process.env.ADMIN_WHATSAPP_NUMBER;
        admin.passwordHash = await bcrypt.hash(password, 10);
        await admin.save();

        const token = generateToken(admin._id);
        res.json({
            message: 'Admin setup complete',
            token,
            user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
        });
    } catch (error) {
        logger.error('Setup error:', error);
        res.status(500).json({ error: 'Setup failed' });
    }
});

module.exports = router;
