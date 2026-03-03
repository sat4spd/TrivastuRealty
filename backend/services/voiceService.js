const axios = require('axios');
const FormData = require('form-data');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

/**
 * Transcribe audio from WhatsApp voice note using OpenAI Whisper API
 */
const transcribeAudio = async (mediaId) => {
    try {
        // 1. Get media URL from WhatsApp
        const mediaUrl = await whatsappService.getMediaUrl(mediaId);
        if (!mediaUrl) {
            logger.error('Could not get media URL for voice note');
            return null;
        }

        // 2. Download audio buffer
        const audioBuffer = await whatsappService.downloadMedia(mediaUrl);
        if (!audioBuffer) {
            logger.error('Could not download voice note');
            return null;
        }

        // 3. Send to OpenAI Whisper for transcription
        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'voice.ogg', contentType: 'audio/ogg' });
        form.append('model', 'whisper-1');
        form.append('language', 'en'); // Auto-detect would work too

        const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            }
        );

        const text = response.data?.text?.trim();
        logger.info(`🎤 Voice transcribed: "${text}"`);
        return text || null;
    } catch (error) {
        logger.error('Voice transcription error:', error.response?.data || error.message);

        // Fallback: try Gemini
        try {
            return await transcribeWithGemini(mediaId);
        } catch (e) {
            logger.error('Gemini transcription fallback failed:', e.message);
            return null;
        }
    }
};

/**
 * Fallback transcription using Gemini (if Whisper fails)
 */
const transcribeWithGemini = async (mediaId) => {
    // Simple fallback — return null to trigger "please type" message
    return null;
};

module.exports = { transcribeAudio };
