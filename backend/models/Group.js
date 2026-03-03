const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    groupId: { type: String, required: true, unique: true },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        phone: String,
        name: String,
        joinedAt: { type: Date, default: Date.now },
    }],
    requiredMembers: { type: Number, default: 4 },
    discountPercent: { type: Number, default: 5 },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    status: {
        type: String,
        enum: ['forming', 'complete', 'expired', 'cancelled'],
        default: 'forming',
    },
    inviteLink: { type: String, default: '' },
    commissionBonus: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date },
}, { timestamps: true });

groupSchema.index({ groupId: 1 });
groupSchema.index({ status: 1 });

module.exports = mongoose.model('Group', groupSchema);
