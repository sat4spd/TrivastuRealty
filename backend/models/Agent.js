const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true, index: true },
    name: { type: String, required: true },
    aadhaar: { type: String, default: '' },
    pan: { type: String, default: '' },
    experience: { type: String, default: '' },
    bankDetails: { type: String, default: '' },
    operatingArea: { type: String, default: '' },
    commissionPercent: { type: Number, default: 2 },
    assignedProjects: [{ type: String }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'suspended'],
        default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    totalDeals: { type: Number, default: 0 },
    totalCommission: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 0 },
    aiRating: { type: Number, default: 5.0, min: 1.0, max: 5.0 }, // Dynamic rating based on conversion speed
}, { timestamps: true });

agentSchema.index({ status: 1 });

module.exports = mongoose.model('Agent', agentSchema);
