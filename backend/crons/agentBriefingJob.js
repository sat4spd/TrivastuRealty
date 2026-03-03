/**
 * agentBriefingJob.js
 * CRON Job: Sends a daily morning WhatsApp briefing to all active agents.
 * Summarizes hot leads, pending visits, and AI actionable insights.
 */

const cron = require('node-cron');
const Agent = require('../models/Agent');
const Lead = require('../models/Lead');
const whatsappService = require('../services/whatsappService');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../utils/logger');

// Run everyday at 9:00 AM IST (Node server should be in IST or cron adjusted)
const scheduleAgentBriefing = () => {
    cron.schedule('0 9 * * *', async () => {
        logger.info('☀️ Running Daily Agent AI Briefing CRON Job');
        try {
            await sendDailyBriefings();
        } catch (error) {
            logger.error('CRON Error (Agent Briefing):', error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
};

const sendDailyBriefings = async () => {
    // 1. Get all approved agents
    const activeAgents = await Agent.find({ status: 'approved' }).populate('userId');

    for (const agent of activeAgents) {
        if (!agent.phone) continue;

        // 2. Fetch leads assigned to this agent
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));

        const myLeads = await Lead.find({ agentId: agent._id }).populate('customerId');

        const hotLeads = myLeads.filter(l => l.aiScore >= 70 && !['closed', 'lost'].includes(l.status));
        const visitsToday = myLeads.filter(l =>
            l.siteVisitDate &&
            new Date(l.siteVisitDate).toDateString() === new Date().toDateString()
        );
        const newLeads = myLeads.filter(l => l.status === 'new');

        // Only send briefing if there is something actionable
        if (hotLeads.length === 0 && visitsToday.length === 0 && newLeads.length === 0) {
            continue;
        }

        let msg = `☀️ *Good Morning, ${agent.name}!*\n\nHere is your Daily AI Briefing 📈\n\n`;

        // ── Visits ──
        if (visitsToday.length > 0) {
            msg += `📅 *Visits Today (${visitsToday.length}):*\n`;
            visitsToday.forEach(l => {
                const time = new Date(l.siteVisitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msg += `• ${time} - ${l.customerId?.name || 'Client'} (${l.location})\n`;
            });
            msg += `\n`;
        }

        // ── Hot Leads ──
        if (hotLeads.length > 0) {
            msg += `🔥 *Hot Leads to Call (${hotLeads.length}):*\n`;
            hotLeads.slice(0, 3).forEach(l => {
                msg += `• *${l.customerId?.name || 'Client'}* [Score: ${l.aiScore}/100]\n  💰 ${formatCurrency(l.budget)} | 📍 ${l.location}\n`;
            });
            if (hotLeads.length > 3) msg += `  _+${hotLeads.length - 3} more..._\n`;
            msg += `\n`;
        }

        // ── New Leads ──
        if (newLeads.length > 0) {
            msg += `🆕 *Uncontacted Leads: ${newLeads.length}*\nPlease update their status today.\n\n`;
        }

        msg += `Have a productive day! 🚀\nType *MENU* to view your dashboard.`;

        // 3. Send via WhatsApp
        try {
            await whatsappService.sendTextMessage(agent.phone, msg);
            logger.info(`Briefing sent to agent: ${agent.name}`);
        } catch (err) {
            logger.error(`Failed to send briefing to ${agent.phone}`, err.message);
        }
    }
};

module.exports = { scheduleAgentBriefing, sendDailyBriefings };
