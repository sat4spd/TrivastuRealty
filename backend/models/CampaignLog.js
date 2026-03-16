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
    errorReason: {
        type: String,
        default: ''
    },
    sentAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '7d' // Auto-delete documents after 7 days
    }
});

// Index for reporting
campaignLogSchema.index({ campaignId: 1, status: 1 });

module.exports = mongoose.model('CampaignLog', campaignLogSchema);
