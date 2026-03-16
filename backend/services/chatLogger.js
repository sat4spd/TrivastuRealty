const ChatMessage = require('../models/ChatMessage');
const { detectRole } = require('./roleDetector');
const logger = require('../utils/logger');

let io = null;
const setSocketIO = (socket) => {
    io = socket;
};

const logChat = async (phone, direction, type, content, mediaUrl = '', isBroadcast = false) => {
    try {
        // Find user role (creates a Lead if customerFlow intercepts it later, but we just want the role here)
        const { role } = await detectRole(phone);

        // Save to DB
        const msg = await ChatMessage.create({
            phone,
            direction,
            messageType: type,
            content,
            mediaUrl,
            role,
            isBroadcast, // Flag to hide from active CRM Inbox or prevent lead triggers if needed
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
