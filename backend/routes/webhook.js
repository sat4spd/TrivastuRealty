const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { processMessage, processMediaMessage, processVoiceMessage } = require('../services/flowEngine');
const whatsappConfig = require('../config/whatsapp');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');
const CampaignLog = require('../models/CampaignLog');
const OptOut = require('../models/OptOut');
const Lead = require('../models/Lead');

// Opt-out trigger phrases (Hindi + English)
const OPT_OUT_PHRASES = ['stop', 'unsubscribe', 'opt out', 'optout', 'hatao', 'band karo', 'mat bhejo', 'no more', 'remove me', 'block'];

// Auto-reply phrases — messages from automated systems / OOO bots (will be silently ignored)
// These are checked as substrings (lowercased) so partial matches work
const AUTO_REPLY_PHRASES = [
    // OOO
    'out of office', 'on leave', 'on vacation', 'away from office', 'returning on', 'back on',
    // Automated signals
    'auto reply', 'automatic reply', 'automated message', 'automated response', 'do not reply',
    'do not respond', "don't reply", 'noreply', 'no-reply', 'this is an automated', 'this message is automated',
    // Business acknowledgement bots
    'thank you for contacting', 'thank you for reaching out', 'thanks for connecting',
    'thanks for your message', 'thank you for your message', 'we have received your',
    'we received your', 'your enquiry has been', 'your query has been', 'team will reach out',
    'team will contact', 'we will get back', "we'll get back", 'in the meantime',
    'during business hours', 'outside of business hours', 'outside business hours',
    'our representative', 'our team will', 'will be attended',
    // Hindi equivalents
    'dhanyawad', 'shukriya', 'hum jald', 'team aapko', 'aapka sandesh mila', 'aapka message mila',
];

// Returns true if the message looks like an automated/bot response
const isAutoReply = (text) => {
    if (!text || text.length < 8) return false;
    const lower = text.toLowerCase();
    return AUTO_REPLY_PHRASES.some(phrase => lower.includes(phrase));
};

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
        // ── SECURITY: Verify Meta webhook signature ──────────────────────────────
        const appSecret = process.env.WHATSAPP_APP_SECRET;
        if (appSecret) {
            const sigHeader = req.headers['x-hub-signature-256'];
            if (!sigHeader) {
                logger.warn('⚠️ Webhook request missing signature — rejected');
                return res.sendStatus(403);
            }
            const expected = 'sha256=' + crypto
                .createHmac('sha256', appSecret)
                .update(JSON.stringify(req.body))
                .digest('hex');
            if (sigHeader !== expected) {
                logger.warn('❌ Webhook signature mismatch — possible spoofed request');
                return res.sendStatus(403);
            }
        }

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
                                // ── OPT-OUT DETECTION ──
                                const lowerText = text.toLowerCase().trim();
                                if (OPT_OUT_PHRASES.some(phrase => lowerText === phrase || lowerText.startsWith(phrase))) {
                                    logger.info(`🚫 Opt-out triggered by ${phone}: "${text}"`);
                                    OptOut.findOneAndUpdate(
                                        { phone },
                                        { phone, reason: 'user_request', addedAt: new Date() },
                                        { upsert: true, new: true }
                                    ).catch(err => logger.error('Failed to save opt-out:', err.message));

                                    // Send confirmation & stop processing
                                    whatsappService.sendTextMessage(phone, "We have noted your preference. You will not receive further marketing messages from Trivastu Realty. 🙏").catch(() => {});
                                    break;
                                }

                                // ── CHECK IF USER IS OPTED OUT BEFORE PROCESSING ──
                                const isOptedOut = await OptOut.findOne({ phone });
                                if (isOptedOut) {
                                    logger.info(`⏭️ Ignored message from opted-out user ${phone}`);
                                    break;
                                }

                                // ── AUTO-REPLY DETECTION ──
                                if (isAutoReply(text)) {
                                    logger.info(`🤖 Auto-reply blocked from ${phone}: "${text.substring(0, 80)}"`);
                                    break; // silently drop — do NOT create lead or reply
                                }

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

                            // Intercept marketing campaign responses
                            if (text === 'marketing_interested' || text === 'marketing_optout') {
                                try {
                                    if (text === 'marketing_interested') {
                                        await whatsappService.sendTextMessage(phone, "Thank you for your interest! An agent will contact you shortly. 📞");
                                        // Update Campaign Log
                                        await CampaignLog.findOneAndUpdate(
                                            { phone },
                                            { $set: { status: 'interested' } },
                                            { sort: { createdAt: -1 } }
                                        );
                                        // Now we *allow* it to drop into the CRM by converting it to a text message
                                        // so that the Lead gets created for the agent.
                                        await processMessage(phone, "I am interested in the marketing campaign.", messageId);
                                    } else if (text === 'marketing_optout') {
                                        await whatsappService.sendTextMessage(phone, "We have noted your preference and will not send further marketing messages. 🙏");
                                        await CampaignLog.findOneAndUpdate(
                                            { phone },
                                            { $set: { status: 'opted_out' } },
                                            { sort: { createdAt: -1 } }
                                        );
                                        // Do NOT pass to processMessage to avoid CRM spam
                                    }
                                } catch (e) {
                                    logger.error('Failed to process marketing response:', e.message);
                                }
                                break;
                            }

                            if (text) {
                                // Route welcome action buttons to processMessage so flowEngine + customerFlow handle them
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
