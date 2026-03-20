const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'agent', 'customer'], default: 'customer' },
    email: { type: String, default: '' },
    budget: { type: Number, default: 0 },
    locationPreference: { type: String, default: '' },
    propertyType: {
        type: String,
        default: '',
    },
    timeline: { type: String, default: '' },
    conversationState: {
        flow: { type: String, default: '' },
        step: { type: String, default: '' },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    // Persistent conversation history for LLM context (last 50 messages)
    conversationHistory: {
        type: [{
            role: { type: String, enum: ['user', 'assistant'], required: true },
            content: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
        }],
        default: [],
    },
    // Last confirmed search context (for follow-up queries)
    lastSearchContext: {
        location: { type: String, default: '' },
        budget: { type: Number, default: 0 },
        propertyType: { type: String, default: '' },
        bedrooms: { type: Number, default: 0 },
        updatedAt: { type: Date },
    },
    lastInteraction: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    passwordHash: { type: String, default: '' },

    // Enterprise: Behavioral Analytics
    behavior: {
        totalClicks: { type: Number, default: 0 },
        recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
        savedProperties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
        budgetShifts: { type: Number, default: 0 }, // Track how often they change budget
    },
    // Throttle admin alerts for preference changes
    lastPrefNotifiedAt: { type: Date, default: null }
}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.index({ locationPreference: 1, budget: 1 });

// Auto-trim conversation history to last 50 messages before save and force Mixed state saving
userSchema.pre('save', function (next) {
    if (this.isModified('conversationState')) {
        this.markModified('conversationState.data');
    } else if (this.conversationState && this.conversationState.data) {
        this.markModified('conversationState.data');
    }

    if (this.conversationHistory && this.conversationHistory.length > 50) {
        this.conversationHistory = this.conversationHistory.slice(-50);
    }
    next();
});

/**
 * Helper: append a message to conversation history
 */
userSchema.methods.addToHistory = function (role, content) {
    if (!this.conversationHistory) this.conversationHistory = [];
    this.conversationHistory.push({ role, content, timestamp: new Date() });
    // Keep only last 50
    if (this.conversationHistory.length > 50) {
        this.conversationHistory = this.conversationHistory.slice(-50);
    }
};

/**
 * Helper: get last N messages as [{role, content}] for LLM
 */
userSchema.methods.getRecentHistory = function (n = 10) {
    if (!this.conversationHistory) return [];
    return this.conversationHistory.slice(-n).map(m => ({
        role: m.role,
        content: m.content,
    }));
};

/**
 * Helper: Update behavior footprint when viewing a property
 */
userSchema.methods.trackPropertyView = function (propertyId) {
    if (!this.behavior) this.behavior = { totalClicks: 0, recentlyViewed: [], savedProperties: [], budgetShifts: 0 };
    this.behavior.totalClicks += 1;

    // Add to recently viewed, keeping max 10, removing duplicates
    const viewed = this.behavior.recentlyViewed.filter(id => id.toString() !== propertyId.toString());
    viewed.unshift(propertyId);
    this.behavior.recentlyViewed = viewed.slice(0, 10);
};

module.exports = mongoose.model('User', userSchema);
