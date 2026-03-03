const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['apartment', 'villa', 'plot', 'commercial', 'farmhouse'], required: true },
    price: { type: Number, required: true },
    location: { type: String, required: true },
    // Area and Subdivision
    area: { type: Number, required: true },
    unit: { type: String, enum: ['sqft', 'sqm', 'acres', 'decimals', 'hectares'], default: 'sqft' },
    totalArea: { type: Number, default: function () { return this.area; } },
    availableArea: { type: Number, default: function () { return this.area; } },

    // Commission
    agentCommissionRate: { type: Number, default: 2.0 }, // Percentage like 2% or 5%

    bedrooms: { type: Number, default: 0 },
    amenities: [{ type: String }],
    images: [{ type: String }],   // S3 keys
    videos: [{ type: String }],   // S3 keys
    media: [{
        key: String,
        type: { type: String, enum: ['image', 'video', 'document'] },
        url: String,
    }],
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    projectName: { type: String, default: '' },
    isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

propertySchema.index({ status: 1, isAvailable: 1 });
propertySchema.index({ location: 1, price: 1, type: 1 });
propertySchema.index({ addedBy: 1 });

module.exports = mongoose.model('Property', propertySchema);
