const axios = require('axios');
const whatsappConfig = require('../config/whatsapp');
const logger = require('../utils/logger');
const { logChat } = require('./chatLogger');

const api = axios.create({
    baseURL: whatsappConfig.apiUrl,
    headers: {
        Authorization: `Bearer ${whatsappConfig.token}`,
        'Content-Type': 'application/json',
    },
});

// WhatsApp API requires phone numbers WITHOUT '+' prefix and as a String
const cleanPhone = (phone) => {
    if (!phone) return '';
    return String(phone).replace(/\+/g, '').replace(/\s+/g, '').trim();
};

const sendTextMessage = async (to, text, isBroadcast = false) => {
    try {
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: cleanPhone(to),
            type: 'text',
            text: { body: String(text || '') },
        });
        logger.info(`Message sent to ${to}`);
        logChat(to, 'outgoing', 'text', text, '', isBroadcast);
        return response.data;
    } catch (error) {
        logger.error('Failed to send text message:', error.response?.data || error.message);
        throw error;
    }
};

const sendInteractiveButtons = async (to, bodyText, buttons, isBroadcast = false) => {
    try {
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: cleanPhone(to),
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: String(bodyText || '') },
                action: {
                    buttons: buttons.map((btn, i) => ({
                        type: 'reply',
                        reply: { id: String(btn.id || `btn_${i}`), title: String(btn.title || '').substring(0, 20) },
                    })),
                },
            },
        });
        
        logChat(to, 'outgoing', 'interactive', bodyText, '', isBroadcast);
        return response.data;
    } catch (error) {
        logger.error('Failed to send interactive buttons:', error.response?.data || error.message);
        throw error;
    }
};

const sendInteractiveList = async (to, bodyText, buttonText, sections) => {
    try {
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: cleanPhone(to),
            type: 'interactive',
            interactive: {
                type: 'list',
                body: { text: String(bodyText || '') },
                action: {
                    button: String(buttonText || '').substring(0, 20),
                    sections,
                },
            },
        });
        return response.data;
    } catch (error) {
        logger.error('Failed to send interactive list:', error.response?.data || error.message);
        throw error;
    }
};

const sendTemplate = async (to, templateName, components = [], isBroadcast = false) => {
    try {
        const phone = cleanPhone(to);
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
                name: String(templateName).trim(),
                language: { code: 'en' },
                components: components
            },
        };

        // NUCLEAR FIX: Use direct axios to bypass any instance-level header/config issues
        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${whatsappConfig.phoneNumberId}/messages`,
            payload,
            { 
                headers: { 
                    'Authorization': `Bearer ${whatsappConfig.token.trim()}`,
                    'Content-Type': 'application/json'
                } 
            }
        );

        logChat(to, 'outgoing', 'template', `Template: ${templateName}`, '', isBroadcast);
        return response.data;
    } catch (error) {
        const errorData = error.response?.data?.error;
        const errorMsg = errorData?.message || error.message;
        const dataDetails = errorData?.error_data?.details || '';
        
        logger.error(`❌ Meta Cloud API Error [${templateName}]:`, errorMsg, dataDetails);
        throw new Error(`${errorMsg} ${dataDetails}`.trim());
    }
};

const sendMediaMessage = async (to, mediaType, mediaUrl, caption = '') => {
    try {
        const mediaObj = { link: mediaUrl };
        if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
            mediaObj.caption = caption;
        }
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: cleanPhone(to),
            type: mediaType,
            [mediaType]: mediaObj,
        });
        logChat(to, 'outgoing', mediaType, caption || `[${mediaType}]`, mediaUrl);
        return response.data;
    } catch (error) {
        logger.error('Failed to send media:', error.response?.data || error.message);
        throw error;
    }
};

const markAsRead = async (messageId) => {
    try {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        });
    } catch (error) {
        logger.debug('Failed to mark as read:', error.message);
    }
};

const getMediaUrl = async (mediaId) => {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/v22.0/${mediaId}`,
            { headers: { Authorization: `Bearer ${whatsappConfig.token}` } }
        );
        return response.data.url;
    } catch (error) {
        logger.error('Failed to get media URL:', error.message);
        return null;
    }
};

const downloadMedia = async (url) => {
    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${whatsappConfig.token}` },
            responseType: 'arraybuffer',
        });
        return Buffer.from(response.data);
    } catch (error) {
        logger.error('Failed to download media:', error.message);
        return null;
    }
};

const getTemplates = async () => {
    try {
        let wabaId = whatsappConfig.wabaId;

        if (!wabaId) {
            // 1. Try to Get WABA ID using Phone Number ID (Often fails due to Admin token permission restrictions)
            try {
                const phoneRes = await axios.get(
                    `https://graph.facebook.com/v22.0/${whatsappConfig.phoneNumberId}?fields=whatsapp_business_account_id`,
                    { headers: { Authorization: `Bearer ${whatsappConfig.token}` } }
                );
                wabaId = phoneRes.data.whatsapp_business_account_id?.id;
            } catch (err) {
                logger.warn('Failed dynamic WABA ID lookup. Token may lack "whatsapp_business_management". Set WHATSAPP_BUSINESS_ACCOUNT_ID in .env');
            }
        }
        
        if (!wabaId) {
            logger.warn("No WABA ID configured. Cannot fetch templates.");
            return []; // Prevent frontend crash
        }

        // 2. Fetch templates for this WABA
        const templatesRes = await axios.get(
            `https://graph.facebook.com/v22.0/${wabaId}/message_templates?limit=100`,
            { headers: { Authorization: `Bearer ${whatsappConfig.token}` } }
        );
        
        // Return only approved templates
        return templatesRes.data.data.filter(t => t.status === 'APPROVED');
    } catch (error) {
        logger.error('Failed to fetch templates:', error.response?.data || error.message);
        return []; // Fallback to empty to prevent UI completely breaking
    }
};

// Send a WhatsApp Flow (native in-app form) to a recipient
// This triggers the real Meta native form inside WhatsApp — no browser needed
const sendFlowMessage = async (to, { bodyText, ctaText, flowId, headerText } = {}) => {
    try {
        const fId = flowId || process.env.WHATSAPP_FLOW_ID;
        if (!fId) {
            logger.warn('sendFlowMessage: No WHATSAPP_FLOW_ID set in .env — falling back to text message');
            return sendTextMessage(to, bodyText || 'Please share your details so we can find the best property for you! 🏠');
        }

        const payload = {
            messaging_product: 'whatsapp',
            to: cleanPhone(to),
            type: 'interactive',
            interactive: {
                type: 'flow',
                header: headerText ? { type: 'text', text: headerText } : undefined,
                body: { text: bodyText || 'Please fill in your property requirements. Takes less than a minute! 🏠' },
                footer: { text: 'Trivastu Realty — Trusted across Jharkhand' },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_action: 'navigate',
                        flow_id: fId,
                        flow_cta: ctaText || '📝 Fill Details',
                        flow_action_payload: { screen: 'JOIN_NOW' },
                        mode: process.env.NODE_ENV === 'production' ? 'published' : 'draft',
                    },
                },
            },
        };

        // Remove undefined header if not set
        if (!headerText) delete payload.interactive.header;

        const response = await api.post('/messages', payload);
        logChat(to, 'outgoing', 'flow', 'WhatsApp Flow: Property Details Form');
        logger.info(`📋 Flow message sent to ${to}`);
        return response.data;
    } catch (error) {
        logger.error('Failed to send flow message:', error.response?.data || error.message);
        // Graceful fallback
        return sendTextMessage(to, 'Aapka naam, budget, aur preferred location share karein — main aapke liye best properties dhundhti hoon! 😊');
    }
};

// Send multiple messages to the same recipient with a natural delay between each

// This mimics a human typing multiple short messages — much more natural than one long wall of text
const sendSequentialMessages = async (to, messages, delayMs = 1200) => {
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (typeof msg === 'string') {
            await sendTextMessage(to, msg);
        } else if (msg.type === 'buttons') {
            await sendInteractiveButtons(to, msg.body, msg.buttons);
        }
        if (i < messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
};

module.exports = {
    sendTextMessage,
    sendInteractiveButtons,
    sendInteractiveList,
    sendTemplate,
    sendMediaMessage,
    markAsRead,
    getMediaUrl,
    downloadMedia,
    getTemplates,
    sendSequentialMessages,
    sendFlowMessage,
};
