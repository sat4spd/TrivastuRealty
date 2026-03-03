const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'agent', 'customer'], default: 'customer' },
    email: { type: String, default: '' },
    budget: { type: Number, default: 0 },
    locationPreference: { type: String, default: '' },
    propertyType: { type: String, enum: ['apartment', 'villa', 'plot', 'commercial', ''], default: '' },
    timeline: { type: String, default: '' },
    conversationState: {
        flow: { type: String, default: '' },
        step: { type: String, default: '' },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    lastInteraction: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    passwordHash: { type: String, default: '' },
}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.index({ locationPreference: 1, budget: 1 });

module.exports = mongoose.model('User', userSchema);
