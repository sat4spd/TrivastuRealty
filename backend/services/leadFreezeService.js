/**
 * Lead Freeze Service
 * 
 * When a new user or campaign reply messages us, we silently create a lead in "pending_info" state.
 * The freeze timer gives us 10 minutes to collect: name, budget, location, property type.
 * If the user goes quiet for 10 minutes, we promote the lead to "new" and notify admin
 * with whatever information we collected.
 * 
 * Every new message resets the timer (sliding window).
 */

const logger = require('../utils/logger');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { notifyAdmin, ALERT_TYPES } = require('./notificationService');

// In-memory map of active timers: phone → NodeJS Timeout
const freezeTimers = new Map();

// 10 minutes in milliseconds
const FREEZE_DURATION_MS = 10 * 60 * 1000;

/**
 * Start or reset the freeze timer for a phone number.
 * Called on every new inbound message from a lead-pending user.
 */
const startFreezeTimer = (phone) => {
    // Cancel any existing timer for this phone
    if (freezeTimers.has(phone)) {
        clearTimeout(freezeTimers.get(phone));
    }

    const timer = setTimeout(async () => {
        freezeTimers.delete(phone);
        await promoteLeadToAdmin(phone);
    }, FREEZE_DURATION_MS);

    freezeTimers.set(phone, timer);
    logger.info(`[FREEZE] Timer started/reset for ${phone} (${FREEZE_DURATION_MS / 60000} min)`);
};

/**
 * Cancel the freeze timer (e.g. if user explicitly completed onboarding earlier).
 */
const cancelFreezeTimer = (phone) => {
    if (freezeTimers.has(phone)) {
        clearTimeout(freezeTimers.get(phone));
        freezeTimers.delete(phone);
        logger.info(`[FREEZE] Timer cancelled for ${phone}`);
    }
};

/**
 * Called when the freeze timer fires.
 * Promotes the lead from pendingInfo to 'new' and notifies admin.
 */
const promoteLeadToAdmin = async (phone) => {
    try {
        // Find the pending lead for this customer
        const user = await User.findOne({ phone });
        if (!user) return;

        const lead = await Lead.findOne({ customerId: user._id, pendingInfo: true });
        if (!lead) {
            logger.info(`[FREEZE] No pending lead found for ${phone} — may have been promoted already`);
            return;
        }

        // Mark as promoted
        lead.pendingInfo = false;
        lead.adminNotified = true;
        lead.status = 'new';
        await lead.save();

        // Compose admin notification with whatever info we have
        const name = user.name || 'Unknown';
        const budget = lead.budget || 0;
        const location = lead.location || 'Not specified';
        const propertyType = lead.propertyType || 'Not specified';

        logger.info(`[FREEZE] Promoting lead for ${phone} → notifying admin. Name: ${name}`);

        await notifyAdmin(ALERT_TYPES.NEW_LEAD, {
            name,
            phone,
            budget,
            location,
            propertyType,
            notes: lead.initialMessage ? `First message: "${lead.initialMessage}"` : '',
        });

    } catch (err) {
        logger.error(`[FREEZE] Error promoting lead for ${phone}:`, err.message);
    }
};

/**
 * Create a pending lead for a new inbound user if one doesn't exist.
 * Also starts/resets the freeze timer.
 */
const ensurePendingLead = async (phone, initialMessage = '', source = 'whatsapp') => {
    try {
        const user = await User.findOne({ phone });
        if (!user) return; // User should already exist by the time this is called

        // Check if a pending (or existing) lead already exists
        let lead = await Lead.findOne({ customerId: user._id, pendingInfo: true });

        if (!lead) {
            // Check for any existing lead (non-pending)
            const existingLead = await Lead.findOne({ customerId: user._id });
            if (existingLead) {
                // Already has a fully promoted lead — just reset the timer in case they want to reply
                startFreezeTimer(phone);
                return;
            }

            // Create a new partial lead in pending state
            lead = await Lead.create({
                customerId: user._id,
                status: 'new',
                source,
                pendingInfo: true,
                adminNotified: false,
                initialMessage: initialMessage.substring(0, 500),
                budget: 0,
                location: '',
                propertyType: '',
            });

            logger.info(`[FREEZE] Created pending lead for ${phone}: ${lead._id}`);
        }

        // Start or reset the 10-min timer
        startFreezeTimer(phone);

    } catch (err) {
        logger.error(`[FREEZE] Error ensuring pending lead for ${phone}:`, err.message);
    }
};

/**
 * Update the pending lead with collected information.
 */
const updatePendingLead = async (phone, updates = {}) => {
    try {
        const user = await User.findOne({ phone });
        if (!user) return;

        const lead = await Lead.findOne({ customerId: user._id, pendingInfo: true });
        if (!lead) return;

        if (updates.budget && updates.budget > 0) lead.budget = updates.budget;
        if (updates.location) lead.location = updates.location;
        if (updates.propertyType) lead.propertyType = updates.propertyType;

        await lead.save();
        logger.info(`[FREEZE] Updated pending lead for ${phone}:`, JSON.stringify(updates));
    } catch (err) {
        logger.error(`[FREEZE] Error updating pending lead for ${phone}:`, err.message);
    }
};

module.exports = {
    startFreezeTimer,
    cancelFreezeTimer,
    promoteLeadToAdmin,
    ensurePendingLead,
    updatePendingLead,
};
