const User = require('../models/User');
const Lead = require('../models/Lead');
const BroadcastLog = require('../models/BroadcastLog');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

const sendBroadcast = async (sentBy, templateName, filters = {}, customMessage = '') => {
    try {
        // Build query based on filters
        const userQuery = { role: 'customer', isActive: true };

        if (filters.location) {
            userQuery.locationPreference = { $regex: filters.location, $options: 'i' };
        }
        if (filters.budgetMin || filters.budgetMax) {
            userQuery.budget = {};
            if (filters.budgetMin) userQuery.budget.$gte = filters.budgetMin;
            if (filters.budgetMax) userQuery.budget.$lte = filters.budgetMax;
        }

        let recipients = await User.find(userQuery).lean();

        // Filter by lead stage if specified
        if (filters.leadStage) {
            const leadsWithStage = await Lead.find({ status: filters.leadStage }).select('customerId').lean();
            const customerIds = leadsWithStage.map(l => l.customerId.toString());
            recipients = recipients.filter(r => customerIds.includes(r._id.toString()));
        }

        if (recipients.length === 0) {
            return { success: false, message: 'No recipients match the filters' };
        }

        // Send messages
        const results = [];
        for (const recipient of recipients) {
            try {
                if (templateName && templateName !== 'custom') {
                    await whatsappService.sendTemplate(recipient.phone, templateName);
                } else {
                    await whatsappService.sendTextMessage(recipient.phone, customMessage);
                }
                results.push({ phone: recipient.phone, status: 'sent' });
            } catch (error) {
                results.push({ phone: recipient.phone, status: 'failed' });
                logger.error(`Broadcast failed for ${recipient.phone}:`, error.message);
            }

            // Rate limiting: 20 messages per second
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Log broadcast
        const log = await BroadcastLog.create({
            templateName: templateName || 'custom',
            sentBy,
            filters,
            recipients: results,
            totalRecipients: recipients.length,
            deliveredCount: results.filter(r => r.status === 'sent').length,
            sentAt: new Date(),
        });

        return {
            success: true,
            totalRecipients: recipients.length,
            delivered: results.filter(r => r.status === 'sent').length,
            failed: results.filter(r => r.status === 'failed').length,
            logId: log._id,
        };
    } catch (error) {
        logger.error('Broadcast error:', error);
        throw error;
    }
};

const getBroadcastLogs = async (page = 1, limit = 20) => {
    const logs = await BroadcastLog.find()
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sentBy', 'name')
        .lean();

    const total = await BroadcastLog.countDocuments();
    return { logs, total, page, pages: Math.ceil(total / limit) };
};

module.exports = { sendBroadcast, getBroadcastLogs };
