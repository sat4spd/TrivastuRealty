const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Group = require('../models/Group');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/groups/create
router.post('/create', auth, async (req, res) => {
    try {
        const { propertyId, discountPercent } = req.body;
        const groupId = `GRP-${uuidv4().substring(0, 8).toUpperCase()}`;
        const inviteLink = `https://trivastu.com/group/${groupId}`;

        const group = await Group.create({
            groupId,
            members: [{ userId: req.user._id, phone: req.user.phone, name: req.user.name }],
            propertyId,
            discountPercent: discountPercent || 5,
            inviteLink,
            createdBy: req.user._id,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        res.status(201).json(group);
    } catch (error) {
        logger.error('Create group error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// POST /api/groups/:id/join
router.post('/:id/join', auth, async (req, res) => {
    try {
        const group = await Group.findOne({ groupId: req.params.id });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.status !== 'forming') return res.status(400).json({ error: 'Group is no longer accepting members' });
        if (group.members.length >= group.requiredMembers) {
            return res.status(400).json({ error: 'Group is already full' });
        }

        const alreadyMember = group.members.some(m => m.userId?.toString() === req.user._id.toString());
        if (alreadyMember) return res.status(400).json({ error: 'Already a member' });

        group.members.push({ userId: req.user._id, phone: req.user.phone, name: req.user.name });

        if (group.members.length >= group.requiredMembers) {
            group.status = 'complete';
        }

        await group.save();

        // Notify all members
        for (const member of group.members) {
            try {
                await whatsappService.sendTextMessage(member.phone,
                    `👥 *Group Update: ${group.groupId}*\n\n${req.user.name} has joined!\nMembers: ${group.members.length}/${group.requiredMembers}\n${group.status === 'complete' ? '🎉 Group is COMPLETE! Discount unlocked!' : ''}`
                );
            } catch (e) { /* continue */ }
        }

        res.json(group);
    } catch (error) {
        logger.error('Join group error:', error);
        res.status(500).json({ error: 'Failed to join group' });
    }
});

// GET /api/groups
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const groups = await Group.find()
            .populate('propertyId', 'title price location')
            .sort({ createdAt: -1 }).lean();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

// GET /api/groups/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const group = await Group.findOne({ groupId: req.params.id })
            .populate('propertyId', 'title price location');
        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch group' });
    }
});

module.exports = router;
