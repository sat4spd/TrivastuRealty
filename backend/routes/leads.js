const express = require('express');
const Lead = require('../models/Lead');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { calculateCommission } = require('../services/commissionService');
const logger = require('../utils/logger');

const router = express.Router();

// Temporary Admin Endpoint to clean up broadcast pollution & duplicate users
router.get('/system-cleanup', async (req, res) => {
    try {
        const User = require('../models/User');
        const CampaignLog = require('../models/CampaignLog');
        
        // 1. Delete Leads created in the last 6 hours that have 0 budget and no notes
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const recentLeads = await Lead.find({ createdAt: { $gt: sixHoursAgo } }).populate('customerId');
        
        let deletedLeadsCount = 0;
        let deletedUsersCount = 0;

        for (const lead of recentLeads) {
            if (lead.customerId && lead.customerId.phone) {
                const wasInCampaign = await CampaignLog.findOne({ 
                    phone: { $in: [lead.customerId.phone, lead.customerId.phone.replace('+91', '')] },
                    createdAt: { $gt: sixHoursAgo }
                });

                if (wasInCampaign || lead.budget === 0 || lead.customerId.name === 'there' || lead.customerId.name === 'Admin') {
                    if (lead.status === 'new' && (!lead.notes || lead.notes.length === 0)) {
                        await Lead.findByIdAndDelete(lead._id);
                        deletedLeadsCount++;

                        // Remove user husk
                        const otherLeads = await Lead.countDocuments({ customerId: lead.customerId._id });
                        if (otherLeads === 0 && lead.customerId.name !== 'Admin') {
                            await User.findByIdAndDelete(lead.customerId._id);
                            deletedUsersCount++;
                        }
                    }
                }
            }
        }

        // 2. Merge Duplicate Users caused by the old 10-digit phone bug (7757920539 vs +917757920539)
        const allUsers = await User.find({ role: 'customer' });
        const phoneMap = {};
        let mergedUsersCount = 0;

        for (const u of allUsers) {
            let normalized = u.phone.replace(/[^0-9]/g, '');
            if (normalized.length === 10) normalized = '91' + normalized;
            if (normalized.length === 12 && normalized.startsWith('91')) normalized = '+' + normalized;

            if (!phoneMap[normalized]) {
                phoneMap[normalized] = u;
            } else {
                const existing = phoneMap[normalized];
                const toDelete = (u.createdAt > existing.createdAt) ? u : existing;
                const toKeep = (u.createdAt > existing.createdAt) ? existing : u;
                
                await Lead.updateMany({ customerId: toDelete._id }, { customerId: toKeep._id });
                await User.findByIdAndDelete(toDelete._id);
                phoneMap[normalized] = toKeep;
                mergedUsersCount++;
            }
        }

        res.json({
            success: true,
            message: "Database Cleanup Complete",
            deletedSpamLeads: deletedLeadsCount,
            deletedHuskUsers: deletedUsersCount,
            mergedDuplicateUsers: mergedUsersCount
        });
    } catch (error) {
        logger.error('Cleanup Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/leads
router.get('/', auth, authorize('admin', 'agent'), async (req, res) => {
    try {
        const { status, isHighValue, page = 1, limit = 20 } = req.query;
        const query = {};

        if (req.user.role === 'agent') {
            const Agent = require('../models/Agent');
            const agent = await Agent.findOne({ userId: req.user._id });
            if (agent) query.agentId = agent._id;
            else return res.json({ leads: [], total: 0 });
        }

        if (status) query.status = status;
        if (isHighValue === 'true') query.isHighValue = true;

        const leads = await Lead.find(query)
            .populate('customerId', 'name phone email budget locationPreference')
            .populate('agentId', 'name phone')
            .populate('propertyId', 'title price location')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        const total = await Lead.countDocuments(query);
        res.json({ leads, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        logger.error('Get leads error:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

// GET /api/leads/:id
router.get('/:id', auth, authorize('admin', 'agent'), async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('customerId', 'name phone email budget locationPreference propertyType timeline')
            .populate('agentId', 'name phone')
            .populate('propertyId');
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
});

// PUT /api/leads/:id/status
router.put('/:id/status', auth, authorize('admin', 'agent'), audit('status_change', 'lead'), async (req, res) => {
    try {
        const { status, note, soldArea, saleAmount } = req.body;
        const validStatuses = ['new', 'contacted', 'site_visit', 'negotiation', 'booked', 'closed', 'lost'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updateData = { status };
        if (note) {
            updateData.$push = { notes: { text: note, addedBy: req.user._id } };
        }

        // If booked/closed and has agent + property, calculate commission and deduct available inventory
        if (status === 'booked' || status === 'closed') {
            const currentLead = await Lead.findById(req.params.id).populate('propertyId');
            // Only trigger if not already booked/closed to prevent double-counting
            if (currentLead && !['booked', 'closed'].includes(currentLead.status)) {
                if (currentLead.agentId && currentLead.propertyId) {
                    const finalAmount = Number(saleAmount) || currentLead.propertyId.price;
                    const finalArea = Number(soldArea) || currentLead.propertyId.area;

                    // Deduct available Area
                    if (currentLead.propertyId.availableArea !== undefined) {
                        currentLead.propertyId.availableArea -= finalArea;
                        if (currentLead.propertyId.availableArea < 0) currentLead.propertyId.availableArea = 0;
                        await currentLead.propertyId.save();
                    }

                    await calculateCommission(currentLead.agentId, finalAmount, currentLead._id, currentLead.propertyId._id, currentLead.propertyId.agentCommissionRate);
                }
            }
        }

        const lead = await Lead.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .populate('customerId', 'name phone email')
            .populate('agentId', 'name')
            .populate('propertyId', 'title');
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        res.json(lead);
    } catch (error) {
        logger.error('Update lead status error:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// PUT /api/leads/:id/assign
router.put('/:id/assign', auth, authorize('admin'), audit('assign', 'lead'), async (req, res) => {
    try {
        const { agentId } = req.body;
        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { agentId, status: 'contacted' },
            { new: true }
        ).populate('agentId', 'name phone');
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign lead' });
    }
});

// POST /api/leads/whatsapp-initiate
// Admin triggers a WhatsApp greeting to a customer to start their onboarding & lead creation
router.post('/whatsapp-initiate', auth, authorize('admin'), async (req, res) => {
    try {
        const { phone, note } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });

        const { parsePhone } = require('../utils/helpers');
        const { handleNewCustomer } = require('../services/customerFlow');
        const whatsappService = require('../services/whatsappService');

        const normalizedPhone = parsePhone(phone);

        // Fire the WhatsApp onboarding greeting
        await handleNewCustomer(normalizedPhone);

        // If admin added a personal note, send it as a second message with a slight delay
        if (note && note.trim()) {
            setTimeout(async () => {
                try {
                    await whatsappService.sendTextMessage(normalizedPhone,
                        `📌 *Special Note from our team:*\n${note.trim()}`
                    );
                } catch (e) { /* non-critical */ }
            }, 3000);
        }

        logger.info(`📲 Admin initiated WhatsApp lead for ${normalizedPhone}`);
        res.json({ success: true, phone: normalizedPhone, message: 'WhatsApp greeting sent!' });
    } catch (error) {
        logger.error('WhatsApp initiate error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to initiate WhatsApp conversation' });
    }
});

module.exports = router;
