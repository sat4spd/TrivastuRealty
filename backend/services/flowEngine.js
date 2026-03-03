const { detectRole } = require('./roleDetector');
const { handleNewCustomer, handleReturningCustomer, handleCustomerMessage } = require('./customerFlow');
const { handleAgentRegistration, handleAgentRegistrationFlow, handleApprovedAgent, handleAgentMedia } = require('./agentFlow');
const { handleAdminMessage, handleAdminMedia } = require('./adminFlow');
const whatsappService = require('./whatsappService');
const { getSignedUrl, uploadBuffer } = require('./s3Service');
const { parsePhone } = require('../utils/helpers');
const logger = require('../utils/logger');
const axios = require('axios');
const { logChat } = require('./chatLogger');

const GREETINGS = ['hi', 'hello', 'hey', 'hii', 'hiii', 'namaste', 'start'];

// ── PROCESS TEXT MESSAGE ──
const processMessage = async (phone, message, messageId) => {
    try {
        const normalizedPhone = parsePhone(phone);
        const text = message?.trim() || '';

        // Mark message as read
        if (messageId) {
            await whatsappService.markAsRead(messageId).catch(() => { });
        }

        // Detect role
        const { role, user, agent } = await detectRole(normalizedPhone);
        logger.info(`📩 Message from ${normalizedPhone} | Role: ${role} | Text: "${text.substring(0, 80)}"`);

        // Log to Chat History
        logChat(normalizedPhone, 'incoming', 'text', text);

        switch (role) {
            case 'admin':
                await handleAdminMessage(normalizedPhone, text, user);
                break;

            case 'approved_agent':
                await handleApprovedAgent(normalizedPhone, text, user, agent);
                break;

            case 'pending_agent':
                await whatsappService.sendTextMessage(normalizedPhone,
                    `⏳ Hi ${agent.name}! Your registration is *pending approval*.\n\nYou'll be notified once approved. 🙏`
                );
                break;

            case 'suspended_agent':
                await whatsappService.sendTextMessage(normalizedPhone,
                    `🚫 Your agent account is *suspended*. Contact admin for details.`
                );
                break;

            case 'rejected_agent':
                await whatsappService.sendTextMessage(normalizedPhone,
                    `Your registration was not approved. Contact our office for details.`
                );
                break;

            case 'customer':
                // Check if in registration flow
                if (user.conversationState?.flow === 'agent_registration') {
                    await handleAgentRegistrationFlow(normalizedPhone, text, user);
                } else if (user.conversationState?.flow === 'onboarding' || user.conversationState?.step) {
                    await handleCustomerMessage(normalizedPhone, text, user);
                } else {
                    // Returning customer
                    const lower = text.toLowerCase();
                    if (lower === 'register as agent' || lower === 'agent registration') {
                        await handleAgentRegistration(normalizedPhone);
                    } else {
                        await handleReturningCustomer(normalizedPhone, user);
                    }
                }
                break;

            case 'new_user':
                if (text.toLowerCase() === 'register as agent' || text.toLowerCase() === 'agent registration') {
                    await handleAgentRegistration(normalizedPhone);
                } else {
                    await handleNewCustomer(normalizedPhone);
                }
                break;

            default:
                await handleNewCustomer(normalizedPhone);
        }

        // Update last interaction
        if (user) {
            user.lastInteraction = new Date();
            await user.save();
        }
    } catch (error) {
        logger.error('Flow engine error:', error.message, error.stack);
        try {
            await whatsappService.sendTextMessage(parsePhone(phone),
                `Sorry, something went wrong. Please try again or type *MENU*. 🙏`
            );
        } catch (e) {
            logger.error('Failed to send error message:', e.message);
        }
    }
};

// ── PROCESS MEDIA MESSAGE (images/videos) ──
const processMediaMessage = async (phone, mediaId, mediaType, caption, messageId) => {
    try {
        const normalizedPhone = parsePhone(phone);
        const whatsappConfig = require('../config/whatsapp');

        // Mark as read
        if (messageId) {
            await whatsappService.markAsRead(messageId).catch(() => { });
        }

        // Detect role
        const { role, user, agent } = await detectRole(normalizedPhone);
        logger.info(`📎 Media from ${normalizedPhone} | Role: ${role} | Type: ${mediaType}`);

        // Get URL first, then log it
        const _mediaUrlForLog = await whatsappService.getMediaUrl(mediaId); // just for logging
        logChat(normalizedPhone, 'incoming', mediaType, caption || `[${mediaType}]`, _mediaUrlForLog || '');

        // Download media from WhatsApp
        const mediaUrl = await whatsappService.getMediaUrl(mediaId);
        if (!mediaUrl) {
            await whatsappService.sendTextMessage(normalizedPhone, `❌ Could not process the ${mediaType}. Please try again.`);
            return;
        }

        const mediaBuffer = await whatsappService.downloadMedia(mediaUrl);
        if (!mediaBuffer) {
            await whatsappService.sendTextMessage(normalizedPhone, `❌ Could not download the ${mediaType}. Please try again.`);
            return;
        }

        // Upload to S3
        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const s3Key = `properties/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

        await uploadBuffer(mediaBuffer, s3Key, contentType);
        logger.info(`📤 Media uploaded to S3: ${s3Key}`);

        // Route to appropriate handler
        if (role === 'admin') {
            const handled = await handleAdminMedia(normalizedPhone, s3Key, mediaType, user);
            if (!handled) {
                await whatsappService.sendTextMessage(normalizedPhone,
                    `📎 Media received & stored!\n\nTo add it to a property, type *add property* first.`
                );
            }
        } else if (role === 'approved_agent') {
            const handled = await handleAgentMedia(normalizedPhone, s3Key, mediaType, user, agent);
            if (!handled) {
                await whatsappService.sendTextMessage(normalizedPhone,
                    `📎 Media received!\n\nTo add it to a property, type *add property* from the agent menu.`
                );
            }
        } else {
            await whatsappService.sendTextMessage(normalizedPhone,
                `📎 Thanks for sharing! If you'd like to share documents, our agent will assist you. Type *MENU* for options.`
            );
        }

    } catch (error) {
        logger.error('Media processing error:', error.message);
    }
};

// ── PROCESS VOICE NOTE ──
const processVoiceMessage = async (phone, mediaId, messageId) => {
    try {
        const normalizedPhone = parsePhone(phone);
        const { transcribeAudio } = require('./voiceService');

        // Mark as read
        if (messageId) {
            await whatsappService.markAsRead(messageId).catch(() => { });
        }

        logger.info(`🎤 Voice note from ${normalizedPhone}`);

        // Transcribe voice
        const transcribedText = await transcribeAudio(mediaId);

        // Log voice note (we use original media ID/URL for audio if we had it, but mostly we want the text)
        logChat(normalizedPhone, 'incoming', 'audio', transcribedText || '[Voice Note]');

        if (transcribedText && transcribedText.length > 0) {
            // Send acknowledgment with transcription
            await whatsappService.sendTextMessage(normalizedPhone,
                `🎤 _I heard:_ "${transcribedText}"\n\n_Processing your message..._`
            );

            // Process as regular text message
            await processMessage(normalizedPhone, transcribedText, messageId);
        } else {
            // Transcription failed
            await whatsappService.sendTextMessage(normalizedPhone,
                `🎤 I received your voice message but couldn't understand it clearly.\n\n` +
                `Could you please *type your message* instead? 🙏\n\n` +
                `Or try speaking more clearly and send again.`
            );
        }
    } catch (error) {
        logger.error('Voice processing error:', error.message);
        try {
            await whatsappService.sendTextMessage(parsePhone(phone),
                `🎤 Sorry, I couldn't process your voice note. Please type your message instead. 🙏`
            );
        } catch (e) { }
    }
};

module.exports = { processMessage, processMediaMessage, processVoiceMessage };

