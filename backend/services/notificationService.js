const nodemailer = require('nodemailer');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');
const { formatCurrency } = require('../utils/helpers');

let io = null;

const setSocketIO = (socketIO) => {
    io = socketIO;
};

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const ALERT_TYPES = {
    NEW_LEAD: 'new_lead',
    HIGH_VALUE_LEAD: 'high_value_lead',
    AGENT_REGISTRATION: 'agent_registration',
    AGENT_APP: 'agent_registration',
    PROPERTY_UPLOAD: 'property_upload',
    SITE_VISIT: 'site_visit',
    SITE_VISIT_BOOKED: 'site_visit',
    PAYMENT_CONFIRMATION: 'payment_confirmation',
};

const notifyAdmin = async (type, data) => {
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
    let message = '';
    let emailSubject = '';

    switch (type) {
        case ALERT_TYPES.NEW_LEAD:
            message = `🏠 *New Lead Created*\n\n👤 Name: ${data.name}\n📞 Phone: ${data.phone}\n💰 Budget: ${formatCurrency(data.budget)}\n📍 Location: ${data.location}\n🏗️ Type: ${data.propertyType}`;
            emailSubject = `New Lead: ${data.name}`;
            break;

        case ALERT_TYPES.HIGH_VALUE_LEAD:
            message = `💎 *HIGH-VALUE LEAD!*\n\n👤 Name: ${data.name}\n📞 Phone: ${data.phone}\n💰 Budget: ${formatCurrency(data.budget)}\n📍 Location: ${data.location}\n\n⚡ Immediate attention required!`;
            emailSubject = `🔥 High-Value Lead: ${data.name} (${formatCurrency(data.budget)})`;
            break;

        case ALERT_TYPES.AGENT_REGISTRATION:
            message = `👨‍💼 *Agent Registration Request*\n\n👤 Name: ${data.name}\n📞 Phone: ${data.phone}\n🔧 Experience: ${data.experience}\n\n✅ Reply APPROVE ${data.phone}\n❌ Reply REJECT ${data.phone}`;
            emailSubject = `Agent Registration: ${data.name}`;
            break;

        case ALERT_TYPES.PROPERTY_UPLOAD:
            message = `🏗️ *New Property Uploaded*\n\n🏠 Title: ${data.title}\n💰 Price: ${formatCurrency(data.price)}\n📍 Location: ${data.location}\n👤 Added by: ${data.agent || data.agentName}\n\n⏳ Awaiting your approval`;
            emailSubject = `Property Upload: ${data.title}`;
            break;

        case ALERT_TYPES.SITE_VISIT:
            message = `📅 *Site Visit Booked*\n\n👤 Customer: ${data.customerName}\n🏠 Property: ${data.propertyTitle}\n📅 Date: ${data.visitDate}\n👨‍💼 Agent: ${data.agentName}`;
            emailSubject = `Site Visit: ${data.customerName}`;
            break;

        case ALERT_TYPES.PAYMENT_CONFIRMATION:
            message = `💳 *Payment Confirmed*\n\n👤 Customer: ${data.customerName}\n💰 Amount: ${formatCurrency(data.amount)}\n🏠 Property: ${data.propertyTitle}`;
            emailSubject = `Payment: ${formatCurrency(data.amount)}`;
            break;

        default:
            message = `📢 *Notification*\n\n${JSON.stringify(data, null, 2)}`;
            emailSubject = 'Trivastu Realty Notification';
    }

    // 1. WhatsApp notification to ALL admins
    const adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || process.env.ADMIN_WHATSAPP_NUMBER || '')
        .split(',').map(n => n.trim()).filter(Boolean);
    try {
        for (const adminPhone of adminNumbers) {
            await whatsappService.sendTextMessage(adminPhone, message);
        }
        logger.info(`Admin WhatsApp alert sent to ${adminNumbers.length} admin(s): ${type}`);
    } catch (error) {
        logger.error('Admin WhatsApp notification failed:', error.message);
    }

    // 2. Email notification
    try {
        await transporter.sendMail({
            from: `"Trivastu Realty" <${process.env.EMAIL_FROM}>`,
            to: process.env.EMAIL_FROM,
            subject: emailSubject,
            text: message.replace(/\*/g, ''),
            html: `<div style="font-family: Arial; padding: 20px; background: #1a1a2e; color: #eee; border-radius: 10px;">
        <h2 style="color: #e94560;">Trivastu Realty Alert</h2>
        <pre style="white-space: pre-wrap; color: #fff;">${message.replace(/\*/g, '<b>').replace(/<b>/g, '<b>').replace(/<\/b>/g, '</b>')}</pre>
      </div>`,
        });
        logger.info(`Admin email alert sent: ${type}`);
    } catch (error) {
        logger.error('Admin email notification failed:', error.message);
    }

    // 3. Socket.io dashboard notification
    if (io) {
        io.emit('admin_notification', { type, data, message, timestamp: new Date() });
        logger.info(`Dashboard notification emitted: ${type}`);
    }
};

module.exports = { notifyAdmin, setSocketIO, ALERT_TYPES };
