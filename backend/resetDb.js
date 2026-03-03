require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const Agent = require('./models/Agent');
const AuditLog = require('./models/AuditLog');
const BroadcastLog = require('./models/BroadcastLog');
const ChatMessage = require('./models/ChatMessage');
const Commission = require('./models/Commission');
const Group = require('./models/Group');
const Lead = require('./models/Lead');
const Property = require('./models/Property');
const User = require('./models/User');

const resetDatabase = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to MongoDB for Reset Operation...');

        await Agent.deleteMany({});
        console.log('🗑️ Deleted all Agents');

        await AuditLog.deleteMany({});
        console.log('🗑️ Deleted all Audit Logs');

        await BroadcastLog.deleteMany({});
        console.log('🗑️ Deleted all Broadcast Logs');

        await ChatMessage.deleteMany({});
        console.log('🗑️ Deleted all Chat Messages');

        await Commission.deleteMany({});
        console.log('🗑️ Deleted all Commissions');

        await Group.deleteMany({});
        console.log('🗑️ Deleted all Groups');

        await Lead.deleteMany({});
        console.log('🗑️ Deleted all Leads');

        await Property.deleteMany({});
        console.log('🗑️ Deleted all Properties');

        const deletedUsers = await User.deleteMany({ role: { $ne: 'admin' } });
        console.log(`🗑️ Deleted ${deletedUsers.deletedCount} Customers/Users (Admins Preserved)`);

        console.log('🎉 Database Cleanup Complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to reset DB:', error);
        process.exit(1);
    }
};

resetDatabase();
