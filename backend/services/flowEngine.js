const { detectRole } = require('./roleDetector');
const { handleNewCustomer, handleReturningCustomer, handleCustomerMessage } = require('./customerFlow');
const { handleAgentRegistration, handleAgentRegistrationFlow, handleApprovedAgent, handleAgentMedia } = require('./agentFlow');
const { handleAdminMessage, handleAdminMedia } = require('./adminFlow');
const whatsappService = require('./whatsappService');
const { getSignedUrl, uploadBuffer } = require('./s3Service');
const { parsePhone } = require('../utils/helpers');
const logger = require('../utils/logger');
const { logChat } = require('./chatLogger');

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

        // Log to Chat History (System monitor)
        logChat(normalizedPhone, 'incoming', 'text', text);

        // State recovery: If state object exists but is corrupted, empty it
        if (user && user.conversationState && typeof user.conversationState !== 'object') {
            user.conversationState = { flow: 'onboarding', step: 'menu', data: {} };
            await user.save();
        }

        switch (role) {
            case 'admin':
                await handleAdminMessage(normalizedPhone, text, user);
                break;

            case 'approved_agent':
                await handleApprovedAgent(normalizedPhone, text, user, agent);
                break;

            case 'pending_agent':
                await whatsappService.sendTextMessage(normalizedPhone,
                    `⏳ Hi ${agent.name}! Your registration is *pending approval*.\nYou'll be notified once approved. 🙏`
                );
                break;

            case 'suspended_agent':
                await whatsappService.sendTextMessage(normalizedPhone,
                    `🚫 Your agent account is *suspended*. Contact admin for details.`
                );
                break;

            case 'rejected_agent':
                await whatsappService.sendTextMessage(normalizedPhone,
                    `Your agent registration was not approved. Contact our office for details.`
                );
                break;

            case 'customer':
                if (user.conversationState?.flow === 'agent_registration') {
                    await handleAgentRegistrationFlow(normalizedPhone, text, user);
                } else if (user.conversationState?.flow === 'in_form') {
                    // Button-driven lead capture form — route straight to handleCustomerMessage which routes to handleLeadForm
                    await handleCustomerMessage(normalizedPhone, text, user);
                } else if (text === 'start_form') {
                    // User tapped "Share My Details" from welcome buttons — start the in-WhatsApp lead form
                    user.conversationState = { flow: 'in_form', step: 'form', data: { formStep: 1, formData: {} } };
                    await user.save();
                    const { handleLeadForm } = require('./customerFlow');
                    await handleLeadForm(normalizedPhone, user, '');
                } else if (user.conversationState?.flow === 'onboarding' || user.conversationState?.step) {
                    await handleCustomerMessage(normalizedPhone, text, user);
                } else {
                    // Safety hatch: if missing state, treat as returning customer
                    const lower = text.toLowerCase();
                    if (lower === 'register as agent' || lower === 'agent registration') {
                        await handleAgentRegistration(normalizedPhone);
                    } else {
                        // Let customerFlow handle smart message routing via detectIntent
                        await handleCustomerMessage(normalizedPhone, text, user);
                    }
                }
                break;

            case 'new_user':
                if (text.toLowerCase() === 'register as agent' || text.toLowerCase() === 'agent registration') {
                    await handleAgentRegistration(normalizedPhone);
                } else {
                    // Pass actual message text so ARIA can answer their question first
                    await handleNewCustomer(normalizedPhone, text);
                }
                break;

            default:
                await handleNewCustomer(normalizedPhone, text);
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

        if (messageId) {
            await whatsappService.markAsRead(messageId).catch(() => { });
        }

        const { role, user, agent } = await detectRole(normalizedPhone);
        logger.info(`📎 Media from ${normalizedPhone} | Role: ${role} | Type: ${mediaType}`);

        const _mediaUrlForLog = await whatsappService.getMediaUrl(mediaId); // log only
        logChat(normalizedPhone, 'incoming', mediaType, caption || `[${mediaType}]`, _mediaUrlForLog || '');

        const mediaUrl = await whatsappService.getMediaUrl(mediaId);
        if (!mediaUrl) return whatsappService.sendTextMessage(normalizedPhone, `❌ Could not process the ${mediaType}.`);

        const mediaBuffer = await whatsappService.downloadMedia(mediaUrl);
        if (!mediaBuffer) return whatsappService.sendTextMessage(normalizedPhone, `❌ Could not download the ${mediaType}.`);

        const { uploadBuffer } = require('./s3Service');
        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const s3Key = `properties/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

        if (role === 'admin') {
            await uploadBuffer(mediaBuffer, s3Key, contentType);
            const handled = await handleAdminMedia(normalizedPhone, s3Key, mediaType, user);
            if (!handled) await whatsappService.sendTextMessage(normalizedPhone, `📎 Media received & stored!\n\nTo add it to a property, type *add property* first.`);
        } else if (role === 'approved_agent') {
            await uploadBuffer(mediaBuffer, s3Key, contentType);
            const handled = await handleAgentMedia(normalizedPhone, s3Key, mediaType, user, agent);
            if (!handled) await whatsappService.sendTextMessage(normalizedPhone, `📎 Media received!\n\nTo add it to a property, type *add property* from menu.`);
        } else if (role === 'customer' && mediaType === 'image') {
            // Enterprise AI Feature: Visual Property Discovery
            const { handleCustomerImage } = require('./customerFlow');
            await handleCustomerImage(normalizedPhone, mediaBuffer, user);
        } else {
            await whatsappService.sendTextMessage(normalizedPhone, `📎 Thanks for sharing! Our agent will review this shortly.`);
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

        if (messageId) await whatsappService.markAsRead(messageId).catch(() => { });

        logger.info(`🎤 Voice note from ${normalizedPhone}`);
        const transcribedText = await transcribeAudio(mediaId);

        logChat(normalizedPhone, 'incoming', 'audio', transcribedText || '[Voice Note]');

        if (transcribedText && transcribedText.length > 0) {
            await whatsappService.sendTextMessage(normalizedPhone, `🎤 _I heard:_ "${transcribedText}"\n\n_Processing your message..._`);
            await processMessage(normalizedPhone, transcribedText, messageId);
        } else {
            await whatsappService.sendTextMessage(normalizedPhone, `🎤 I couldn't understand the voice message. Could you please *type* instead? 🙏`);
        }
    } catch (error) {
        logger.error('Voice processing error:', error.message);
        try { await whatsappService.sendTextMessage(parsePhone(phone), `🎤 Sorry, I couldn't process your voice note. Please type your message.`); } catch (e) { }
    }
};

module.exports = { processMessage, processMediaMessage, processVoiceMessage };
