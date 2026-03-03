const ChatMessage = require('../models/ChatMessage');
const { detectRole } = require('./roleDetector');
const logger = require('../utils/logger');

let io = null;
const setSocketIO = (socket) => {
    io = socket;
};

const logChat = async (phone, direction, type, content, mediaUrl = '') => {
    try {
        // Find user role
        const { role } = await detectRole(phone);

        // Save to DB
        const msg = await ChatMessage.create({
            phone,
            direction,
            messageType: type,
            content,
            mediaUrl,
            role,
            timestamp: new Date()
        });

        // Emit to Dashboard connected via Socket.io
        if (io) {
            io.emit('new_chat_message', msg);
        }
    } catch (err) {
        logger.error('Failed to log chat message:', err.message);
    }
};

module.exports = { logChat, setSocketIO };
