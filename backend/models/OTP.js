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
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // Automatically delete document after 5 minutes (300 seconds)
    }
});

module.exports = mongoose.model('OTP', otpSchema);
