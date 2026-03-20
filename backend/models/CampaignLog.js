const mongoose = require('mongoose');

const campaignLogSchema = new mongoose.Schema({
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true,
        index: true
    },
    phone: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'pending'
    },
    // WhatsApp Message ID returned by Meta API — used to match delivery webhooks
    wamid: {
        type: String,
        default: '',
        index: true,   // Fast lookup on delivery status updates
    },
    // Real delivery status tracked via Meta webhook statuses events
    deliveryStatus: {
        type: String,
        enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
        default: 'queued',
    },
    // Timestamps for each delivery stage
    sentAt:       { type: Date },
    deliveredAt:  { type: Date },
    readAt:       { type: Date },
    failedAt:     { type: Date },
    failReason:   { type: String, default: '' }, // Meta error code/title if failed

    errorReason: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d' // Extended from 7d to 30d for proper reporting
    }
});

// Index for reporting: campaignId + deliveryStatus breakdown
campaignLogSchema.index({ campaignId: 1, deliveryStatus: 1 });
campaignLogSchema.index({ campaignId: 1, status: 1 });

module.exports = mongoose.model('CampaignLog', campaignLogSchema);
