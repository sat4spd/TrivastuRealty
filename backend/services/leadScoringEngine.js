/**
 * leadScoringEngine.js
 * Enterprise AI Scoring and Persona Classification for Trivastu Realty Leads
 */

const User = require('../models/User');

/**
 * Calculates a Lead's AI Score (0-100), urgency level, and buyer persona
 *
 * Scoring factors:
 * - High budget (>50L) -> +20
 * - Timeline -> Immediate (+30), 3_months (+15), 6_months (+5)
 * - Engagement -> +2 points per conversation turn (max 20)
 * - Saved Properties -> +5 points each (max 20)
 * - Click footprint -> +1 point per click (max 10)
 *
 * @param {object} lead - Mongoose Lead document
 * @param {object} user - Mongoose User document (customer)
 * @returns {object} { aiScore, urgency, buyerPersona }
 */
const calculateLeadScore = (lead, user) => {
    let score = 0;
    let urgency = 'low';
    let buyerPersona = 'end_user';

    // ── 1. Budget & Timeline ──
    if (lead.budget >= 5000000) {
        score += 20;
    } else if (lead.budget >= 3000000) {
        score += 10;
    }

    const tLower = (user.timeline || '').toLowerCase();
    if (tLower.includes('immediate') || tLower.includes('now') || tLower.includes('soon')) {
        score += 30;
        urgency = 'immediate';
    } else if (tLower.includes('3')) {
        score += 15;
        urgency = 'high';
    } else if (tLower.includes('6')) {
        score += 5;
        urgency = 'medium';
    }

    // ── 2. Behavioral Engagement ──
    if (user.conversationHistory && user.conversationHistory.length > 0) {
        // Only count 'user' messages
        const userTurns = user.conversationHistory.filter(m => m.role === 'user').length;
        score += Math.min(20, userTurns * 2);
    }

    if (user.behavior) {
        const clicks = user.behavior.totalClicks || 0;
        score += Math.min(10, clicks);

        const saves = (user.behavior.savedProperties || []).length;
        score += Math.min(20, saves * 5);

        // High intention if they shift budget specifically upwards
        if (user.behavior.budgetShifts > 2) {
            score += 5;
        }
    }

    // ── 3. Buyer Persona Detection ──
    // Simple heuristic: if they ask about ROI, yield, commercial property, or plots without timeline
    const allText = (user.conversationHistory || []).map(m => m.content.toLowerCase()).join(' ');
    if (
        allText.includes('roi') ||
        allText.includes('yield') ||
        allText.includes('rent') ||
        allText.includes('investment') ||
        allText.includes('invest') ||
        lead.propertyType === 'commercial'
    ) {
        buyerPersona = 'investor';
    }

    return {
        aiScore: Math.min(100, score),
        urgency,
        buyerPersona
    };
};

module.exports = { calculateLeadScore };
