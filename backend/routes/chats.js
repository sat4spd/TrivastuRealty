const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Get all active chats (grouped by phone)
router.get('/sessions', auth, authorize('admin'), async (req, res) => {
    try {
        const sessions = await ChatMessage.aggregate([
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: "$phone",
                    lastMessage: { $first: "$content" },
                    lastMessageTime: { $first: "$timestamp" },
                    role: { $first: "$role" },
                    messageCount: { $sum: 1 }
                }
            },
            { $sort: { lastMessageTime: -1 } },
            { $limit: 100 }
        ]);

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching chat sessions' });
    }
});

// Get chat history for a specific phone number
router.get('/:phone', auth, authorize('admin'), async (req, res) => {
    try {
        const messages = await ChatMessage.find({ phone: req.params.phone })
            .sort({ timestamp: 1 })
            .limit(500);

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching chat history' });
    }
});

module.exports = router;
