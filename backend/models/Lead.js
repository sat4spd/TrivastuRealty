const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    status: {
        type: String,
        enum: ['new', 'contacted', 'site_visit', 'negotiation', 'booked', 'closed', 'lost'],
        default: 'new',
    },
    budget: { type: Number, default: 0 },
    location: { type: String, default: '' },
    propertyType: { type: String, default: '' },
    source: { type: String, enum: ['whatsapp', 'dashboard', 'referral', 'broadcast', 'campaign_reply'], default: 'whatsapp' },
    notes: [{
        text: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
    }],
    siteVisitDate: { type: Date },
    siteVisitImages: [{ type: String }],
    isHighValue: { type: Boolean, default: false },

    // Enterprise: Agent Intelligence
    aiScore: { type: Number, default: 0, min: 0, max: 100 },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'immediate'], default: 'low' },
    buyerPersona: { type: String, enum: ['investor', 'end_user', 'undecided'], default: 'undecided' },

    // Freeze timer fields — admin notified only after 10 min of silence
    pendingInfo: { type: Boolean, default: false }, // True = awaiting freeze timer before notifying admin
    adminNotified: { type: Boolean, default: false }, // True = admin has been notified
    initialMessage: { type: String, default: '' }, // First message the user sent us
}, { timestamps: true });

leadSchema.index({ status: 1 });
leadSchema.index({ agentId: 1 });
leadSchema.index({ customerId: 1 });
leadSchema.index({ isHighValue: 1 });

leadSchema.pre('save', function (next) {
    this.isHighValue = this.budget >= 5000000;
    next();
});

module.exports = mongoose.model('Lead', leadSchema);
