const express = require('express');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { sendBroadcast, getBroadcastLogs } = require('../services/broadcastService');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/broadcast/send
router.post('/send', auth, authorize('admin'), audit('send', 'broadcast'), async (req, res) => {
    try {
        const { templateName, filters, customMessage, targetAudience, propertyId } = req.body;
        const result = await sendBroadcast(req.user._id, templateName, filters, customMessage, targetAudience || 'customers', propertyId || null);
        res.json(result);
    } catch (error) {
        logger.error('Broadcast error:', error);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// GET /api/broadcast/logs
router.get('/logs', auth, authorize('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await getBroadcastLogs(parseInt(page), parseInt(limit));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch broadcast logs' });
    }
});

module.exports = router;
