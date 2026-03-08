const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g. "Basic", "Premium", "Luxury"
    priceRange: { type: String, required: true }, // e.g. "₹1,400 - ₹1,600"
    unit: { type: String, default: '/sq.ft' },
    features: [{ type: String }],
    isPopular: { type: Boolean, default: false },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 }, // Display order
    website: { type: String, enum: ['realty', 'brand', 'plots'], default: 'realty' },
    isPublished: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
