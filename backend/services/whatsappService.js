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

// WhatsApp API requires phone numbers WITHOUT '+' prefix
const cleanPhone = (phone) => phone?.replace(/\+/g, '') || phone;

const sendTextMessage = async (to, text) => {
    try {
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: cleanPhone(to),
            type: 'text',
            text: { body: text },
        });
        logger.info(`Message sent to ${to}`);
        logChat(to, 'outgoing', 'text', text);
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
                body: { text: bodyText },
                action: {
                    buttons: buttons.map((btn, i) => ({
                        type: 'reply',
                        reply: { id: btn.id || `btn_${i}`, title: btn.title.substring(0, 20) },
                    })),
                },
            },
        });
        
        // Log outgoing message. Tell the logger it's a broadcast to prevent Lead creation triggers etc.
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
                body: { text: bodyText },
                action: {
                    button: buttonText.substring(0, 20),
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

const sendTemplate = async (to, templateName, parameters = []) => {
    try {
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: cleanPhone(to),
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'en' },
                components: parameters.length > 0 ? [{
                    type: 'body',
                    parameters: parameters.map(p => ({ type: 'text', text: p })),
                }] : [],
            },
        });
        return response.data;
    } catch (error) {
        logger.error('Failed to send template:', error.response?.data || error.message);
        throw error;
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
};
