const mongoose = require('mongoose');

const broadcastLogSchema = new mongoose.Schema({
    templateName: { type: String, required: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filters: {
        location: { type: String, default: '' },
        budgetMin: { type: Number, default: 0 },
        budgetMax: { type: Number, default: 0 },
        leadStage: { type: String, default: '' },
        groupStatus: { type: String, default: '' },
    },
    recipients: [{ phone: String, status: String }],
    totalRecipients: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    responseCount: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

broadcastLogSchema.index({ sentAt: -1 });

module.exports = mongoose.model('BroadcastLog', broadcastLogSchema);
