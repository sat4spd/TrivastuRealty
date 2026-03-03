/**
 * analyticsService.js
 * Enterprise Analytics & Reporting Engine for Trivastu Admin Dashboard
 */

const Lead = require('../models/Lead');
const Property = require('../models/Property');
const Agent = require('../models/Agent');

/**
 * Generates the master dashboard statistics.
 * Focuses on High Intent leads, AI Conversion Rates, and Unsold Inventory Aging.
 * 
 * @returns {Promise<object>} Returns a comprehensive stats object
 */
const getDashboardStats = async () => {
    // ── 1. Lead Pipeline ──
    const totalLeads = await Lead.countDocuments();
    const activeLeads = await Lead.countDocuments({ status: { $in: ['new', 'contacted', 'site_visit_planned', 'negotiation'] } });
    const closedWon = await Lead.countDocuments({ status: 'closed' });

    // AI Specific
    const hotLeads = await Lead.countDocuments({ aiScore: { $gte: 75 } });
    const immediateUrgency = await Lead.countDocuments({ urgency: 'immediate' });

    // Buyer Persona Breakdown
    const personasRaw = await Lead.aggregate([
        { $group: { _id: "$buyerPersona", count: { $sum: 1 } } }
    ]);
    const personas = personasRaw.reduce((acc, curr) => {
        acc[curr._id || 'undecided'] = curr.count;
        return acc;
    }, {});

    // ── 2. Agent Performance ──
    const topAgents = await Agent.find({ status: 'approved' })
        .sort({ totalDeals: -1, aiRating: -1 })
        .limit(5)
        .select('name phone totalDeals totalVisits aiRating')
        .lean();

    // ── 3. Inventory Aging & Demand Heatmap ──
    // Find what locations are requested most
    const demandHeatmapRaw = await Lead.aggregate([
        { $match: { location: { $exists: true, $ne: '' } } },
        { $group: { _id: "$location", requests: { $sum: 1 } } },
        { $sort: { requests: -1 } },
        { $limit: 5 }
    ]);
    const demandHeatmap = demandHeatmapRaw.map(v => ({ location: v._id, requests: v.requests }));

    // Find aging properties (approved but not sold for > 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const agingInventory = await Property.countDocuments({
        status: 'approved',
        isAvailable: true,
        createdAt: { $lte: thirtyDaysAgo }
    });

    const activeProperties = await Property.countDocuments({ status: 'approved', isAvailable: true });

    return {
        pipeline: {
            total: totalLeads,
            active: activeLeads,
            closedWon: closedWon,
            conversionRate: totalLeads > 0 ? ((closedWon / totalLeads) * 100).toFixed(1) + '%' : '0%'
        },
        aiIntelligence: {
            hotLeads,
            immediateUrgency,
            personas
        },
        inventory: {
            totalActive: activeProperties,
            agingOver30Days: agingInventory,
            demandHeatmap
        },
        topAgents
    };
};

module.exports = { getDashboardStats };
