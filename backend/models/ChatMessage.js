const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    phone: { type: String, required: true, index: true },
    direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
    messageType: { type: String, enum: ['text', 'image', 'video', 'document', 'audio', 'interactive', 'template', 'system'], default: 'text' },
    content: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'approved_agent', 'pending_agent', 'customer', 'new_user', 'system'], required: true },
    isBroadcast: { type: Boolean, default: false }, // Campaign messages — saved for analytics but hidden from Live Chat
    timestamp: { type: Date, default: Date.now }
});

chatMessageSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
