const mongoose = require('mongoose');
const TeamMember = require('../models/TeamMember');
require('dotenv').config({ path: __dirname + '/../.env' });

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const members = await TeamMember.find({});
        console.log("TeamMembers:", JSON.stringify(members, null, 2));

        // Check if there's a Contractor model or collection
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}
check();
