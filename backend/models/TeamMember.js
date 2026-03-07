const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    role: { type: String, required: true }, // e.g., "Lead Architect", "Contractor"
    category: { type: String, default: 'Contractor' }, // e.g., "Management", "Contractor"
    experience: { type: String, default: '' }, // e.g., "15+ Years"
    description: { type: String, default: '' },
    specialties: [{ type: String }], // Array strings e.g. ["Commercial", "Residential"]
    image: { type: String, default: '' }, // Profile picture URL
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    isPublished: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
