const express = require('express');
const router = express.Router();
const { processMessage, processMediaMessage, processVoiceMessage } = require('../services/flowEngine');
const whatsappConfig = require('../config/whatsapp');
const logger = require('../utils/logger');

// Webhook verification (GET)
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === whatsappConfig.verifyToken) {
        logger.info('✅ Webhook verified successfully');
        return res.status(200).send(challenge);
    }

    logger.warn('❌ Webhook verification failed');
    return res.sendStatus(403);
});

// Incoming messages (POST)
router.post('/', async (req, res) => {
    try {
        // Respond immediately to Meta (must respond within 5 seconds)
        res.sendStatus(200);

        const body = req.body;
        logger.info('📨 Webhook POST:', JSON.stringify(body).substring(0, 300));

        if (!body.object) {
            logger.warn('No body.object in payload');
            return;
        }

        const entries = body.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field !== 'messages') continue;

                const value = change.value;
                const messages = value.messages || [];

                for (const message of messages) {
                    const phone = message.from;
                    const messageId = message.id;

                    logger.info(`📩 Message type: ${message.type} from ${phone}`);

                    switch (message.type) {
                        case 'text': {
                            const text = message.text?.body || '';
                            if (text) {
                                processMessage(phone, text, messageId).catch(err => {
                                    logger.error('Text message processing error:', err.message);
                                });
                            }
                            break;
                        }

                        case 'interactive': {
                            let text = '';
                            if (message.interactive?.type === 'button_reply') {
                                text = message.interactive.button_reply.id;
                            } else if (message.interactive?.type === 'list_reply') {
                                text = message.interactive.list_reply.id;
                            }
                            if (text) {
                                processMessage(phone, text, messageId).catch(err => {
                                    logger.error('Interactive message processing error:', err.message);
                                });
                            }
                            break;
                        }

                        case 'image': {
                            const mediaId = message.image?.id;
                            const caption = message.image?.caption || '';
                            if (mediaId) {
                                processMediaMessage(phone, mediaId, 'image', caption, messageId).catch(err => {
                                    logger.error('Image processing error:', err.message);
                                });
                            }
                            break;
                        }

                        case 'video': {
                            const mediaId = message.video?.id;
                            const caption = message.video?.caption || '';
                            if (mediaId) {
                                processMediaMessage(phone, mediaId, 'video', caption, messageId).catch(err => {
                                    logger.error('Video processing error:', err.message);
                                });
                            }
                            break;
                        }

                        case 'document': {
                            const mediaId = message.document?.id;
                            const caption = message.document?.caption || '';
                            if (mediaId) {
                                processMediaMessage(phone, mediaId, 'document', caption, messageId).catch(err => {
                                    logger.error('Document processing error:', err.message);
                                });
                            }
                            break;
                        }

                        case 'audio':
                        case 'voice': {
                            const mediaId = message.audio?.id || message.voice?.id;
                            if (mediaId) {
                                processVoiceMessage(phone, mediaId, messageId).catch(err => {
                                    logger.error('Voice processing error:', err.message);
                                });
                            }
                            break;
                        }

                        default:
                            logger.info(`Unhandled message type: ${message.type}`);
                            // Still process as text with type info
                            processMessage(phone, `[${message.type} message]`, messageId).catch(err => {
                                logger.error('Default processing error:', err.message);
                            });
                    }
                }

                // Handle status updates (delivery, read receipts)
                const statuses = value.statuses || [];
                for (const status of statuses) {
                    logger.debug(`📊 Status: ${status.status} for ${status.id}`);
                }
            }
        }
    } catch (error) {
        logger.error('Webhook error:', error.message);
    }
});

module.exports = router;
