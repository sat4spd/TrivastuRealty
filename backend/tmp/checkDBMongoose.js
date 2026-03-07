require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('../models/Property');
const Agent = require('../models/Agent');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        try {
            const dummyUser = await User.findOne();

            console.log("Testing Agent creation...");
            const agent = new Agent({
                userId: dummyUser._id,
                phone: "+911234567890",
                name: "Test Agent",
                aadhaar: "123412341234",
                pan: "ABCDE1234F",
                experience: "5 years",
                bankDetails: "SBI 123",
                operatingArea: "Indore",
                status: 'pending',
                commissionPercent: 2,
            });
            await agent.validate();
            console.log("Agent validation passed!");

            console.log("Testing Property creation...");
            const property = new Property({
                title: "Test Property",
                type: "apartment",
                price: 5000000,
                location: "Indore",
                area: 1200,
                description: "Test description",
                images: [],
                videos: [],
                status: 'pending',
                addedBy: dummyUser._id,
            });
            await property.validate();
            console.log("Property validation passed!");

        } catch (e) {
            console.error("Validation Error:", e.name, e.message);
        }
        process.exit(0);
    });
