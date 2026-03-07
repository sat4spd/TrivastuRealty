const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    authorName: { type: String, required: true },
    authorRole: { type: String, default: 'Client' },
    content: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    image: { type: String, default: '' }, // Author photo
    projectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, // Optional relation
    isPublished: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', testimonialSchema);
