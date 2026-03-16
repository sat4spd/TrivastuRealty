const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: { error: 'Too many webhook requests.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── OTP-specific brute-force limiter ──────────────────────────────────────
// Keyed by IP + email body field to catch both distributed and single-source attacks.
// Allows max 5 OTP attempts per 15 minutes per unique key.
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,
    keyGenerator: (req) => {
        // Combine IP + email for a per-user+IP key
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const email = (req.body && req.body.email) ? req.body.email.toLowerCase().trim() : 'unknown';
        return `${ip}:${email}`;
    },
    message: {
        error: 'Too many OTP attempts. Please wait 15 minutes before trying again.',
        code: 'OTP_RATE_LIMITED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // count all attempts, even successful ones
});

// ── Login brute-force limiter ─────────────────────────────────────────────
// Separate, tighter limit for password + OTP login attempts.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,
    keyGenerator: (req) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const email = (req.body && req.body.email) ? req.body.email.toLowerCase().trim() : 'unknown';
        return `login:${ip}:${email}`;
    },
    message: {
        error: 'Too many login attempts. Please wait 15 minutes before trying again.',
        code: 'LOGIN_RATE_LIMITED',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, webhookLimiter, otpLimiter, loginLimiter };
