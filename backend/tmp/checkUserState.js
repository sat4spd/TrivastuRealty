require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        try {
            const adminPhone = "+918105180539"; // from task.md
            const user = await User.findOne({ phone: adminPhone });
            if (!user) {
                console.log("Admin user not found.");
            } else {
                console.log("Admin User State:", JSON.stringify(user.conversationState, null, 2));
            }
        } catch (e) {
            console.error("Error:", e);
        }
        process.exit(0);
    });
