/**
 * followUpJob.js
 * CRON Job: Intelligent Automated Follow-ups for Trivastu Realty
 *
 * Rules:
 * 1. Nudges "new" leads that haven't been contacted by agents in 24h
 * 2. Nudges "contacted" leads with high AI scores to ask about their decision
 */

const cron = require('node-cron');
const Lead = require('../models/Lead');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');
const { formatCurrency } = require('../utils/helpers');

const scheduleFollowUps = () => {
    // Run every day at 11:00 AM IST
    cron.schedule('0 11 * * *', async () => {
        logger.info('🕰️ Running Intelligent Lead Follow-ups...');
        try {
            await executeFollowUps();
        } catch (error) {
            logger.error('CRON Error (Follow-ups):', error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
};

const executeFollowUps = async () => {
    const today = new Date();

    // 1. Agent Chase - "New" leads > 24 hours old
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const neglectedLeads = await Lead.find({
        status: 'new',
        createdAt: { $lte: yesterday }
    }).populate('agentId').populate('customerId');

    for (const lead of neglectedLeads) {
        if (!lead.agentId || !lead.agentId.phone) continue;

        const msg = `⚠️ *Action Required!*\n\nYou have a new lead that hasn't been contacted in over 24 hours.\n\n👤 ${lead.customerId?.name}\n📍 ${lead.location}\n💰 ${formatCurrency(lead.budget)}\n\n_Please contact them ASAP to maintain your AI Agent Rating._`;

        try {
            await whatsappService.sendTextMessage(lead.agentId.phone, msg);
        } catch (e) { }
    }

    // 2. Customer Nudge - High intent leads that haven't progressed past contacted in 3 days
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const warmLeads = await Lead.find({
        status: 'contacted',
        aiScore: { $gte: 60 },
        updatedAt: { $lte: threeDaysAgo }
    }).populate('customerId');

    for (const lead of warmLeads) {
        if (!lead.customerId || !lead.customerId.phone) continue;

        const msg = `Hi ${lead.customerId.name}, ARIA here from Trivastu Realty! 👋\n\nI noticed you were looking for a ${lead.propertyType} in ${lead.location}. Were you able to find what you were looking for, or should I show you some of our new listings today? 😊\n\n_(Reply Yes to see new matches)_`;

        try {
            await whatsappService.sendTextMessage(lead.customerId.phone, msg);
            // Log that we nudged them
            const user = await User.findById(lead.customerId._id);
            if (user) {
                user.addToHistory('assistant', msg);
                user.lastInteraction = new Date();
                await user.save();
            }
        } catch (e) { }
    }

    logger.info(`Follow-ups completed: ${neglectedLeads.length} agents nudged, ${warmLeads.length} customers engaged.`);
};

module.exports = { scheduleFollowUps, executeFollowUps };
