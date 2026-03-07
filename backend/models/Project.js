const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, required: true }, // e.g. "Residential", "Commercial", "Plots"
    status: { type: String, enum: ['Completed', 'Ongoing', 'Upcoming'], default: 'Upcoming' },
    description: { type: String, default: '' },
    image: { type: String, default: '' }, // Header/cover image URL
    images: [{ type: String }], // Optional gallery
    isPublished: { type: Boolean, default: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
