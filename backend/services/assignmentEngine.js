/**
 * assignmentEngine.js
 * Smart Agent Lead Assignment Engine for Trivastu Realty
 *
 * Distributes leads based on:
 * 1. Geographical Area Match (Agent's operatingArea vs Lead's location)
 * 2. Load Balancing (Agent with fewest active leads gets priority)
 * 3. Fallback to Admin or General Pool if no match
 */

const Agent = require('../models/Agent');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { notifyAdmin, ALERT_TYPES } = require('./notificationService');

/**
 * Assign an agent to a newly created lead automatically.
 *
 * @param {object} lead - Mongoose Lead document
 * @returns {Promise<string|null>} - Returns Agent ID if assigned, null if not
 */
const assignAgentToLead = async (lead) => {
    try {
        if (!lead.location) return null;

        // 1. Find agents operating in this area
        const locationQuery = new RegExp(lead.location, 'i');
        const candidateAgents = await Agent.find({
            status: 'approved',
            operatingArea: { $regex: locationQuery }
        });

        if (candidateAgents.length === 0) {
            logger.info(`No specific agent found for location: ${lead.location}. Requires manual assignment.`);
            return null;
        }

        // 2. Load Balancing: Find who has the fewest *active* leads
        const agentLoads = await Promise.all(candidateAgents.map(async (agent) => {
            const activeLeadCount = await Lead.countDocuments({
                agentId: agent._id,
                status: { $in: ['new', 'contacted', 'site_visit_planned', 'negotiation'] }
            });
            return { agent, activeCount: activeLeadCount };
        }));

        // Sort by ascending active count
        agentLoads.sort((a, b) => a.activeCount - b.activeCount);

        const selectedAgent = agentLoads[0].agent;

        // 3. Update the lead
        lead.agentId = selectedAgent._id;
        await lead.save();

        logger.info(`Lead ${lead._id} automatically assigned to Agent ${selectedAgent.name} (Load: ${agentLoads[0].activeCount})`);

        // Notify the agent on WhatsApp
        const whatsappService = require('./whatsappService');
        await whatsappService.sendTextMessage(selectedAgent.phone,
            `🚨 *New Lead Assigned!*\n\n` +
            `A new lead matching your area has been assigned to you.\n` +
            `📍 Location: ${lead.location}\n💰 Budget: ₹${lead.budget}\n\n` +
            `Type *my leads* to view details and contact them.`
        );

        return selectedAgent._id;

    } catch (error) {
        logger.error('Agent assignment error:', error.message);
        return null;
    }
};

module.exports = { assignAgentToLead };
