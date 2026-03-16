/**
 * matchingEngine.js — Smart Property Matching with Location Hierarchy
 *
 * Supports:
 * - Multi-location queries ("Tupudana, Nagri, Lodhma")
 * - Jharkhand geographic hierarchy expansion
 * - 3-tier graceful fallback (strict → relax budget → show regional)
 * - Score-based ranking
 */

const Property = require('../models/Property');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../utils/logger');
const { buildLocationQuery, expandLocation } = require('./locationHierarchy');

/**
 * Match properties against customer criteria with smart location expansion
 *
 * @param {object} criteria
 * @param {number} criteria.budget
 * @param {string|string[]} criteria.location - can be "Ranchi", "Tupudana, Nagri", or ["Ranchi"]
 * @param {string} criteria.propertyType
 * @param {number} [criteria.bedrooms]
 * @returns {Promise<Array>}
 */
const matchProperties = async (criteria) => {
    const { budget, location, propertyType, bedrooms } = criteria;

    // ── TIER 1: Strict match ──
    const tier1Query = buildTierQuery({ budget, location, propertyType, bedrooms, budgetTolerance: 0.2 });
    let properties = await Property.find(tier1Query).sort({ price: 1 }).limit(10).lean();

    if (properties.length > 0) {
        logger.info(`🔍 Tier 1 match: ${properties.length} properties`);
        return { properties: scoreAndRank(properties, criteria), matchTier: 'strict' };
    }

    // ── TIER 2: Relax budget by 40% (keep location) ──
    const tier2Query = buildTierQuery({ budget, location, propertyType, bedrooms, budgetTolerance: 0.4 });
    properties = await Property.find(tier2Query).sort({ price: 1 }).limit(8).lean();

    if (properties.length > 0) {
        logger.info(`🔍 Tier 2 match (relaxed budget): ${properties.length} properties`);
        return { properties: scoreAndRank(properties, criteria), matchTier: 'relaxed_budget' };
    }

    // ── TIER 3: Location only (any budget, any type) ──
    if (location) {
        const locationQuery = buildLocationQuery(location);
        const tier3Query = {
            status: 'approved',
            isAvailable: true,
            ...(locationQuery || {}),
        };
        properties = await Property.find(tier3Query).sort({ createdAt: -1 }).limit(5).lean();

        if (properties.length > 0) {
            logger.info(`🔍 Tier 3 match (location only): ${properties.length} properties`);
            return { properties: scoreAndRank(properties, criteria), matchTier: 'location_only' };
        }
    }

    // ── TIER 4: Latest properties in the state (no filters) ──
    properties = await Property.find({ status: 'approved', isAvailable: true })
        .sort({ createdAt: -1 }).limit(5).lean();

    logger.info(`🔍 Tier 4 match (latest): ${properties.length} properties`);
    return { properties: scoreAndRank(properties, criteria), matchTier: 'general' };
};

/**
 * Build a MongoDB query for a tier with given parameters
 */
const buildTierQuery = ({ budget, location, propertyType, bedrooms, budgetTolerance = 0.2 }) => {
    const query = { status: 'approved', isAvailable: true };

    // Budget filter
    if (budget && budget > 0) {
        query.price = {
            $gte: budget * (1 - budgetTolerance),
            $lte: budget * (1 + budgetTolerance),
        };
    }

    // Location filter (with hierarchy expansion)
    if (location) {
        const locationQuery = buildLocationQuery(location);
        if (locationQuery) {
            Object.assign(query, locationQuery);
        }
    }

    // Property type filter
    if (propertyType && propertyType !== 'any') {
        query.type = propertyType;
    }

    // Bedroom filter
    if (bedrooms && bedrooms > 0) {
        query.bedrooms = { $gte: bedrooms };
    }

    return query;
};

/**
 * Score and rank properties by relevance
 */
const scoreAndRank = (properties, criteria) => {
    const { budget, location, propertyType, bedrooms } = criteria;

    // Expand locations for scoring
    const expandedLocations = location ? expandLocation(location) : [];

    const scored = properties.map(p => {
        let score = 0;

        // Budget proximity (max 40 points)
        if (budget && budget > 0 && p.price > 0) {
            const diff = Math.abs(p.price - budget) / budget;
            score += Math.max(0, (1 - diff)) * 40;
        }

        // Location match (max 35 points)
        if (expandedLocations.length > 0) {
            const pLocLower = p.location.toLowerCase();
            if (expandedLocations.some(loc => pLocLower.includes(loc) || loc.includes(pLocLower.replace(/[^a-z]/g, '')))) {
                score += 35;
            }
        }

        // Type match (max 15 points)
        if (propertyType && p.type === propertyType) {
            score += 15;
        }

        // Bedrooms match (max 5 points)
        if (bedrooms && p.bedrooms >= bedrooms) {
            score += 5;
        }

        // Freshness bonus (max 5 points) — newer listings score higher
        const daysSinceCreated = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 5 - daysSinceCreated / 30);

        // Amenities bonus
        score += (p.amenities?.length || 0) * 1.5;

        return { ...p, matchScore: Math.min(100, Math.round(score)) };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, 5);
};

/**
 * Format property list for WhatsApp
 */
const formatPropertyList = (properties) => {
    if (!properties || properties.length === 0) {
        return "No matching properties found at the moment. We'll notify you when new listings match your criteria! 🔔";
    }

    return properties.map((p, i) => {
        const typeLabel = p.type === 'apartment' ? '🏢' : p.type === 'villa' ? '🏡' : p.type === 'plot' ? '🌳' : p.type === 'commercial' ? '🏪' : '🏠';
        const areaStr = p.area ? `📐 ${p.area} ${p.unit || 'sqft'}` : '';
        const bedroomsStr = p.bedrooms ? `🛏 ${p.bedrooms} BHK` : '';
        const matchStr = p.matchScore !== undefined ? `⭐ ${p.matchScore}% match` : '';

        return (
            `${i + 1}. *${p.title}*\n` +
            `   📍 ${p.location}\n` +
            `   💰 ${formatCurrency(p.price)}\n` +
            `   ${typeLabel} ${p.type}${bedroomsStr ? ' | ' + bedroomsStr : ''}${areaStr ? ' | ' + areaStr : ''}\n` +
            (matchStr ? `   ${matchStr}` : '')
        ).trim();
    }).join('\n\n');
};

/**
 * Search for properties by free-form query (location + type + budget)
 * Used when customer asks in natural language
 */
const searchByQuery = async ({ location, budget, propertyType, bedrooms }) => {
    return matchProperties({ location, budget, propertyType, bedrooms });
};

/**
 * Send property list as a WhatsApp Interactive List Message
 * Returns: true if sent as list, false if fell back to text
 */
const sendPropertyInteractiveList = async (toPhone, properties, headerText) => {
    const whatsappService = require('./whatsappService');

    if (!properties || properties.length === 0) {
        await whatsappService.sendTextMessage(toPhone,
            "🔍 No matching properties found right now. We'll notify you when new listings match your criteria! 🔔"
        );
        return true;
    }

    // Group into sections by type
    const typeOrder = ['plot', 'land', 'commercial', 'apartment', 'villa', 'farmhouse'];
    const typeLabel = { plot: '🌳 Plots', land: '🌾 Land', commercial: '🏪 Commercial', apartment: '🏢 Apartments', villa: '🏡 Villas', farmhouse: '🌻 Farmhouses' };
    const grouped = {};
    properties.forEach((p, i) => {
        const key = p.type || 'other';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ ...p, _idx: i + 1 });
    });

    const sections = [];
    [...typeOrder, 'other'].forEach(type => {
        if (!grouped[type] || grouped[type].length === 0) return;
        sections.push({
            title: typeLabel[type] || '🏠 Properties',
            rows: grouped[type].map(p => ({
                id: `property_${p._idx}`,
                title: p.title.substring(0, 24),
                description: `📍 ${p.location} | 💰 ${formatCurrency(p.price)} | 📐 ${p.area || '?'} ${p.unit || ''}${p.matchScore ? ` | ⭐${p.matchScore}%` : ''}`.substring(0, 72),
            })),
        });
    });

    try {
        await whatsappService.sendInteractiveList(
            toPhone,
            headerText || `🏠 *Here are the best properties for you:*\n\nTap a property to view full details!`,
            `📋 View Properties`,
            sections
        );
        return true;
    } catch (e) {
        // Fallback to text
        await whatsappService.sendTextMessage(toPhone,
            `🏠 *Properties for you:*\n\n${formatPropertyList(properties)}\n\nReply with a number for full details!`
        );
        return false;
    }
};

module.exports = { matchProperties, formatPropertyList, sendPropertyInteractiveList, searchByQuery, scoreAndRank };
