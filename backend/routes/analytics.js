const express = require('express');
const Lead = require('../models/Lead');
const Agent = require('../models/Agent');
const Property = require('../models/Property');
const User = require('../models/User');
const Commission = require('../models/Commission');
const BroadcastLog = require('../models/BroadcastLog');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/analytics/overview
router.get('/overview', auth, authorize('admin'), async (req, res) => {
    try {
        const [
            totalLeads, newLeads, contactedLeads, siteVisitLeads,
            negotiationLeads, bookedLeads, closedLeads, lostLeads,
            highValueLeads, totalAgents, activeAgents, pendingAgents,
            totalProperties, approvedProperties, pendingProperties,
            totalCustomers,
        ] = await Promise.all([
            Lead.countDocuments(),
            Lead.countDocuments({ status: 'new' }),
            Lead.countDocuments({ status: 'contacted' }),
            Lead.countDocuments({ status: 'site_visit' }),
            Lead.countDocuments({ status: 'negotiation' }),
            Lead.countDocuments({ status: 'booked' }),
            Lead.countDocuments({ status: 'closed' }),
            Lead.countDocuments({ status: 'lost' }),
            Lead.countDocuments({ isHighValue: true }),
            Agent.countDocuments(),
            Agent.countDocuments({ status: 'approved' }),
            Agent.countDocuments({ status: 'pending' }),
            Property.countDocuments(),
            Property.countDocuments({ status: 'approved' }),
            Property.countDocuments({ status: 'pending' }),
            User.countDocuments({ role: 'customer' }),
        ]);

        const conversionRate = totalLeads > 0 ? ((bookedLeads / totalLeads) * 100).toFixed(1) : 0;

        // Revenue calculation
        const commissions = await Commission.aggregate([
            { $group: { _id: null, totalRevenue: { $sum: '$propertyPrice' }, totalCommission: { $sum: '$amount' } } },
        ]);

        res.json({
            leads: {
                total: totalLeads, new: newLeads, contacted: contactedLeads,
                siteVisit: siteVisitLeads, negotiation: negotiationLeads,
                booked: bookedLeads, closed: closedLeads, lost: lostLeads,
                highValue: highValueLeads, conversionRate: parseFloat(conversionRate),
            },
            agents: { total: totalAgents, active: activeAgents, pending: pendingAgents },
            properties: { total: totalProperties, approved: approvedProperties, pending: pendingProperties },
            customers: { total: totalCustomers },
            revenue: {
                total: commissions[0]?.totalRevenue || 0,
                commission: commissions[0]?.totalCommission || 0,
            },
        });
    } catch (error) {
        logger.error('Analytics overview error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// GET /api/analytics/leads - Lead source & trend data
router.get('/leads', auth, authorize('admin'), async (req, res) => {
    try {
        const leadsBySource = await Lead.aggregate([
            { $group: { _id: '$source', count: { $sum: 1 } } },
        ]);

        const leadsByMonth = await Lead.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            { $limit: 12 },
        ]);

        const leadsByLocation = await Lead.aggregate([
            { $match: { location: { $ne: '' } } },
            { $group: { _id: '$location', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        res.json({ bySource: leadsBySource, byMonth: leadsByMonth, byLocation: leadsByLocation });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lead analytics' });
    }
});

// GET /api/analytics/agents - Agent performance
router.get('/agents', auth, authorize('admin'), async (req, res) => {
    try {
        const agents = await Agent.find({ status: 'approved' })
            .select('name phone totalDeals totalCommission')
            .sort({ totalDeals: -1 })
            .lean();

        // Enrich with lead counts
        for (const agent of agents) {
            agent.activeLeads = await Lead.countDocuments({
                agentId: agent._id,
                status: { $nin: ['closed', 'lost'] },
            });
            agent.closedLeads = await Lead.countDocuments({
                agentId: agent._id,
                status: { $in: ['booked', 'closed'] },
            });
        }

        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch agent analytics' });
    }
});

// GET /api/analytics/properties
router.get('/properties', auth, authorize('admin'), async (req, res) => {
    try {
        const byType = await Property.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$type', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
        ]);

        const byLocation = await Property.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$location', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        res.json({ byType, byLocation });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch property analytics' });
    }
});

// GET /api/analytics/broadcasts
router.get('/broadcasts', auth, authorize('admin'), async (req, res) => {
    try {
        const recent = await BroadcastLog.find()
            .sort({ sentAt: -1 })
            .limit(10)
            .populate('sentBy', 'name')
            .lean();

        const stats = await BroadcastLog.aggregate([
            {
                $group: {
                    _id: null,
                    totalSent: { $sum: '$totalRecipients' },
                    totalDelivered: { $sum: '$deliveredCount' },
                    totalRead: { $sum: '$readCount' },
                    totalResponses: { $sum: '$responseCount' },
                    campaigns: { $sum: 1 },
                }
            }
        ]);

        res.json({ recent, stats: stats[0] || {} });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch broadcast analytics' });
    }
});

module.exports = router;
