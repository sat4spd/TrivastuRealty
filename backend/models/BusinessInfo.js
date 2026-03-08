const mongoose = require('mongoose');

const businessInfoSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'main' }, // Singleton pattern
    companyName: { type: String, default: 'Trivastu Realty' },
    phone: { type: String, default: '+918105180539' },
    altPhone: { type: String, default: '' },
    email: { type: String, default: 'info@trivastu.com' },
    address: { type: String, default: '' },
    city: { type: String, default: 'Ranchi' },
    state: { type: String, default: 'Jharkhand' },
    pincode: { type: String, default: '' },
    googleMapsUrl: { type: String, default: '' },
    googlePlaceId: { type: String, default: '' }, // For Google Reviews API
    // Social Links
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    twitter: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    // Branding
    logo: { type: String, default: '' }, // S3 key
    favicon: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('BusinessInfo', businessInfoSchema);
