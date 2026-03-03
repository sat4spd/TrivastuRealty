const express = require('express');
const Agent = require('../models/Agent');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const whatsappService = require('../services/whatsappService');
const { notifyAdmin, ALERT_TYPES } = require('../services/notificationService');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/agents — List all agents
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = status ? { status } : {};
        const agents = await Agent.find(query)
            .populate('userId', 'name phone email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();
        const total = await Agent.countDocuments(query);
        res.json({ agents, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        logger.error('Get agents error:', error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// GET /api/agents/:id — Get agent by ID
router.get('/:id', auth, authorize('admin', 'agent'), async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id)
            .populate('userId', 'name phone email');
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch agent' });
    }
});

// POST /api/agents — Create agent (admin adds)
router.post('/', auth, authorize('admin'), audit('create', 'agent'), async (req, res) => {
    try {
        const { phone, name, commissionPercent, assignedProjects } = req.body;

        let user = await User.findOne({ phone });
        if (!user) {
            user = await User.create({ phone, name, role: 'agent' });
        } else {
            user.role = 'agent';
            user.name = name || user.name;
            await user.save();
        }

        const agent = await Agent.create({
            userId: user._id,
            phone,
            name: name || user.name,
            commissionPercent: commissionPercent || 2,
            assignedProjects: assignedProjects || [],
            status: 'approved',
            approvedBy: req.user._id,
            approvedAt: new Date(),
        });

        res.status(201).json(agent);
    } catch (error) {
        logger.error('Create agent error:', error);
        res.status(500).json({ error: 'Failed to create agent' });
    }
});

// PUT /api/agents/:id — Update agent
router.put('/:id', auth, authorize('admin'), audit('update', 'agent'), async (req, res) => {
    try {
        const { commissionPercent, assignedProjects, name } = req.body;
        const agent = await Agent.findByIdAndUpdate(
            req.params.id,
            { commissionPercent, assignedProjects, name },
            { new: true }
        );
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update agent' });
    }
});

// PUT /api/agents/:id/status — Approve/Reject/Suspend agent
router.put('/:id/status', auth, authorize('admin'), audit('status_change', 'agent'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected', 'suspended'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const agent = await Agent.findById(req.params.id);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        agent.status = status;
        if (status === 'approved') {
            agent.approvedBy = req.user._id;
            agent.approvedAt = new Date();
        }
        await agent.save();

        // Notify agent via WhatsApp
        try {
            if (status === 'approved') {
                await whatsappService.sendTextMessage(agent.phone,
                    `🎉 *Congratulations, ${agent.name}!*\n\nYour agent registration has been *APPROVED*!\nType *MENU* to access your agent dashboard. 🚀`
                );
            } else if (status === 'rejected') {
                await whatsappService.sendTextMessage(agent.phone,
                    `Hi ${agent.name}, your agent registration was not approved at this time. Please contact our office for more information.`
                );
            } else if (status === 'suspended') {
                await whatsappService.sendTextMessage(agent.phone,
                    `Hi ${agent.name}, your agent account has been suspended. Please contact admin for details.`
                );
            }
        } catch (e) {
            logger.error('Failed to notify agent:', e.message);
        }

        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

module.exports = router;
