const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        required: false,
        trim: true,
    },
    otp: {
        type: String,
        required: true,
    },
    purpose: {
        type: String,
        enum: ['login', 'cms-edit'],
        default: 'login'
    },
    // ── Brute-force protection ───────────────────────────────────────────────
    // Tracks how many times an incorrect OTP has been entered.
    // After MAX_OTP_ATTEMPTS the OTP is invalidated regardless of expiry.
    attempts: {
        type: Number,
        default: 0,
    },
    locked: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // Automatically delete document after 5 minutes (300 seconds)
    }
});

// Max failed attempts before the OTP record is locked (deleted = forced re-request)
otpSchema.statics.MAX_ATTEMPTS = 5;

module.exports = mongoose.model('OTP', otpSchema);
