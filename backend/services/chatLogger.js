const ChatMessage = require('../models/ChatMessage');
const { detectRole } = require('./roleDetector');
const logger = require('../utils/logger');

let io = null;
const setSocketIO = (socket) => {
    io = socket;
};

const logChat = async (phone, direction, type, content, mediaUrl = '', isBroadcast = false) => {
    try {
        // Find user role
        const { role } = await detectRole(phone);

        // Save to DB (always — for analytics and history)
        const msg = await ChatMessage.create({
            phone,
            direction,
            messageType: type,
            content,
            mediaUrl,
            role,
            isBroadcast,
            timestamp: new Date()
        });

        // Only emit to Live Chat dashboard for non-broadcast messages
        // Campaign messages are stored for analytics but should NOT flood Live Chat
        if (io && !isBroadcast) {
            io.emit('new_chat_message', msg);
        }
    } catch (err) {
        logger.error('Failed to log chat message:', err.message);
    }
};

module.exports = { logChat, setSocketIO };
