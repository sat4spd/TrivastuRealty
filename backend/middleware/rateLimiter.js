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

module.exports = { apiLimiter, webhookLimiter };
