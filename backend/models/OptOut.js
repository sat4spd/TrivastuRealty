const mongoose = require('mongoose');

// Tracks numbers who have opted out from campaigns
// When a user replies STOP/hatao/optout, they are added here and never messaged again
const optOutSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: 'user_request' }, // 'user_request' | 'admin' | 'bounce'
    addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OptOut', optOutSchema);
