require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const Testimonial = require('../models/Testimonial');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        try {
            const count = await Testimonial.countDocuments();
            const testimonials = await Testimonial.find().limit(5);
            console.log(`Total Testimonials found: ${count}`);
            console.log("Samples:", JSON.stringify(testimonials, null, 2));
        } catch (e) {
            console.error("Error:", e);
        }
        process.exit(0);
    });
