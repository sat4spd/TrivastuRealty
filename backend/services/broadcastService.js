const User = require('../models/User');
const Agent = require('../models/Agent');
const Lead = require('../models/Lead');
const Property = require('../models/Property');
const BroadcastLog = require('../models/BroadcastLog');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://admin.trivastu.com';

const sendBroadcast = async (sentBy, templateName, filters = {}, customMessage = '', targetAudience = 'customers', propertyId = null) => {
    try {
        let recipients = [];

        if (targetAudience === 'agents') {
            // Send to all approved agents
            const agents = await Agent.find({ status: 'approved' }).populate('userId', 'phone name').lean();
            recipients = agents.map(a => ({ phone: a.userId?.phone, name: a.userId?.name || a.name })).filter(r => r.phone);
        } else {
            // Build customer query
            const userQuery = { role: 'customer', isActive: true };
            if (filters.location) userQuery.locationPreference = { $regex: filters.location, $options: 'i' };
            if (filters.budgetMin || filters.budgetMax) {
                userQuery.budget = {};
                if (filters.budgetMin) userQuery.budget.$gte = filters.budgetMin;
                if (filters.budgetMax) userQuery.budget.$lte = filters.budgetMax;
            }
            let users = await User.find(userQuery).lean();
            if (filters.leadStage) {
                const leadsWithStage = await Lead.find({ status: filters.leadStage }).select('customerId').lean();
                const customerIds = leadsWithStage.map(l => l.customerId.toString());
                users = users.filter(r => customerIds.includes(r._id.toString()));
            }
            recipients = users.map(u => ({ phone: u.phone, name: u.name }));
        }

        if (recipients.length === 0) {
            return { success: false, message: 'No recipients match the filters' };
        }

        // Build message — append property details if specified
        let message = customMessage;
        if (propertyId) {
            const prop = await Property.findById(propertyId).lean();
            if (prop) {
                const formatCurrency = (n) => n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n}`;
                message += `\n\n🏠 *${prop.title}*\n📍 ${prop.location}\n💰 ${formatCurrency(prop.price)}\n📐 ${prop.area} ${prop.unit}\n\n🔗 View Details: ${DASHBOARD_URL}/property/${prop._id}`;
            }
        }

        // Send messages
        const results = [];
        for (const recipient of recipients) {
            try {
                if (templateName && templateName !== 'custom') {
                    await whatsappService.sendTemplate(recipient.phone, templateName);
                } else {
                    await whatsappService.sendTextMessage(recipient.phone, message);
                }
                results.push({ phone: recipient.phone, status: 'sent' });
            } catch (error) {
                results.push({ phone: recipient.phone, status: 'failed' });
                logger.error(`Broadcast failed for ${recipient.phone}:`, error.message);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const log = await BroadcastLog.create({
            templateName: templateName || 'custom',
            sentBy, filters, recipients,
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
