const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'paused', 'completed', 'stopped'],
        default: 'pending'
    },
    totalRecipients: {
        type: Number,
        default: 0
    },
    sentCount: {
        type: Number,
        default: 0
    },
    failedCount: {
        type: Number,
        default: 0
    },
    messageTemplate: {
        type: String,
        default: ''
    },
    messageType: {
        type: String,
        enum: ['template', 'ai'],
        default: 'template'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
