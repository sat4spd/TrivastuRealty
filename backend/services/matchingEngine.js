/**
 * matchingEngine.js — Smart Property Matching with Location Hierarchy
 *
 * Supports:
 * - Multi-location queries ("Tupudana, Nagri, Lodhma")
 * - Jharkhand geographic hierarchy expansion
 * - 4-tier graceful fallback (strict → relax budget → show regional → suggestions)
 * - Score-based ranking
 * - Suggestion padding: if <4 strict matches, pad with "you might also like" properties
 */

const Property = require('../models/Property');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../utils/logger');
const { buildLocationQuery, expandLocation } = require('./locationHierarchy');

const MIN_RESULTS_BEFORE_SUGGESTING = 4; // Pad with suggestions if strict match returns fewer than this

/**
 * Match properties against customer criteria with smart location expansion + suggestion padding
 */
const matchProperties = async (criteria) => {
    const { budget, location, propertyType, bedrooms } = criteria;

    // ── TIER 1: Strict match (±20% budget, location, type) ──
    const tier1Query = buildTierQuery({ budget, location, propertyType, bedrooms, budgetTolerance: 0.2 });
    let strictMatches = await Property.find(tier1Query).sort({ price: 1 }).limit(8).lean();
    strictMatches = scoreAndRank(strictMatches, criteria, false);

    if (strictMatches.length >= MIN_RESULTS_BEFORE_SUGGESTING) {
        logger.info(`🔍 Tier 1 match: ${strictMatches.length} properties`);
        return { properties: strictMatches.slice(0, 6), suggestions: [], matchTier: 'strict' };
    }

    // ── TIER 2: Relax budget to ±60% (keep location) ──
    const tier2Query = buildTierQuery({ budget, location, propertyType, bedrooms, budgetTolerance: 0.6 });
    let relaxedMatches = await Property.find(tier2Query).sort({ price: 1 }).limit(8).lean();
    relaxedMatches = scoreAndRank(relaxedMatches, criteria, false);

    // Merge tier1 + tier2, dedup by _id
    const seenIds = new Set(strictMatches.map(p => String(p._id)));
    const merged = [...strictMatches];
    for (const p of relaxedMatches) {
        if (!seenIds.has(String(p._id))) { merged.push(p); seenIds.add(String(p._id)); }
    }

    if (merged.length >= MIN_RESULTS_BEFORE_SUGGESTING) {
        logger.info(`🔍 Tier 2 match (relaxed budget): ${merged.length} properties`);
        return { properties: merged.slice(0, 6), suggestions: [], matchTier: 'relaxed_budget' };
    }

    // ── TIER 3: Location only (any budget, any type) ──
    if (location) {
        const locationQuery = buildLocationQuery(location);
        const tier3Query = { status: 'approved', isAvailable: true, ...(locationQuery || {}) };
        const tier3Props = await Property.find(tier3Query).sort({ createdAt: -1 }).limit(8).lean();
        const scored3 = scoreAndRank(tier3Props, criteria, false);
        for (const p of scored3) {
            if (!seenIds.has(String(p._id))) { merged.push(p); seenIds.add(String(p._id)); }
        }
    }

    // ── TIER 4: Suggestions from broader catalogue (out of budget/location, tagged) ──
    const allProps = await Property.find({ status: 'approved', isAvailable: true })
        .sort({ createdAt: -1 }).limit(20).lean();
    const suggestionPool = allProps.filter(p => !seenIds.has(String(p._id)));
    const suggestions = scoreAndRank(suggestionPool, criteria, true).slice(0, 4);

    const finalMatches = merged.slice(0, 6);
    logger.info(`🔍 Final: ${finalMatches.length} matches + ${suggestions.length} suggestions`);
    return { properties: finalMatches, suggestions, matchTier: finalMatches.length === 0 ? 'general' : 'partial' };
};

/**
 * Get all available properties for catalogue view
 */
const getCatalogueProperties = async () => {
    return Property.find({ status: 'approved', isAvailable: true })
        .sort({ createdAt: -1 }).limit(50).lean();
};

/**
 * Build a MongoDB query for a tier with given parameters
 */
const buildTierQuery = ({ budget, location, propertyType, bedrooms, budgetTolerance = 0.2 }) => {
    const query = { status: 'approved', isAvailable: true };

    if (budget && budget > 0) {
        query.price = {
            $gte: budget * (1 - budgetTolerance),
            $lte: budget * (1 + budgetTolerance),
        };
    }

    if (location) {
        const locationQuery = buildLocationQuery(location);
        if (locationQuery) Object.assign(query, locationQuery);
    }

    if (propertyType && propertyType !== 'any') {
        query.type = propertyType;
    }

    if (bedrooms && bedrooms > 0) {
        query.bedrooms = { $gte: bedrooms };
    }

    return query;
};

/**
 * Score and rank properties by relevance
 * @param {boolean} isSuggestion - marks property with the suggestion tag
 */
const scoreAndRank = (properties, criteria, isSuggestion = false) => {
    const { budget, location, propertyType, bedrooms } = criteria;
    const expandedLocations = location ? expandLocation(location) : [];

    const scored = properties.map(p => {
        let score = 0;

        if (budget && budget > 0 && p.price > 0) {
            const diff = Math.abs(p.price - budget) / budget;
            score += Math.max(0, (1 - diff)) * 40;
        }

        if (expandedLocations.length > 0) {
            const pLocLower = (p.location || '').toLowerCase();
            if (expandedLocations.some(loc => pLocLower.includes(loc) || loc.includes(pLocLower.replace(/[^a-z]/g, '')))) {
                score += 35;
            }
        }

        if (propertyType && p.type === propertyType) score += 15;
        if (bedrooms && p.bedrooms >= bedrooms) score += 5;

        const daysSince = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 5 - daysSince / 30);
        score += (p.amenities?.length || 0) * 1.5;

        return { ...p, matchScore: Math.min(100, Math.round(score)), isSuggestion };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored;
};

/**
 * Format property list for WhatsApp — includes suggestion label for padded results
 */
const formatPropertyList = (properties, suggestions = []) => {
    const allProps = [...(properties || []), ...(suggestions || [])];
    if (!allProps || allProps.length === 0) {
        return "Abhi koi matching property nahi mili. Hamara advisor aapke liye personally dhundega! 🙏";
    }

    return allProps.map((p, i) => {
        const typeLabel = p.type === 'apartment' ? '🏢' : p.type === 'villa' ? '🏡' : p.type === 'plot' ? '🌳' : p.type === 'commercial' ? '🏪' : '🏠';
        const areaStr = p.area ? `📐 ${p.area} ${p.unit || 'sqft'}` : '';
        const bedroomsStr = p.bedrooms ? `🛏 ${p.bedrooms} BHK` : '';
        const suggestionTag = p.isSuggestion ? '\n   💡 _You might also like this_' : '';

        return (
            `${i + 1}. ${p.isSuggestion ? '💡 ' : ''}*${p.title}*\n` +
            `   📍 ${p.location}\n` +
            `   💰 ${formatCurrency(p.price)}\n` +
            `   ${typeLabel} ${p.type}${bedroomsStr ? ' | ' + bedroomsStr : ''}${areaStr ? ' | ' + areaStr : ''}${suggestionTag}`
        ).trim();
    }).join('\n\n');
};

/**
 * Search for properties by free-form query
 */
const searchByQuery = async ({ location, budget, propertyType, bedrooms }) => {
    return matchProperties({ location, budget, propertyType, bedrooms });
};

/**
 * Send property list as a WhatsApp Interactive List Message
 * Includes matches first, then suggestions (clearly labelled)
 */
const sendPropertyInteractiveList = async (toPhone, properties, headerText, suggestions = []) => {
    const whatsappService = require('./whatsappService');

    const allProps = [...(properties || []), ...(suggestions || [])];

    if (!allProps || allProps.length === 0) {
        await whatsappService.sendInteractiveButtons(
            toPhone,
            "Koi exact matching property abhi nahi mili. Kya main sab available properties dikhaoon?",
            [
                { id: 'browse_all', title: '📖 Browse All' },
                { id: 'connect_agent', title: '📞 Talk to Agent' },
            ]
        );
        return true;
    }

    const typeOrder = ['plot', 'land', 'commercial', 'apartment', 'villa', 'farmhouse'];
    const typeLabel = { plot: '🌳 Plots', land: '🌾 Land', commercial: '🏪 Commercial', apartment: '🏢 Apartments', villa: '🏡 Villas', farmhouse: '🌻 Farmhouses' };

    const grouped = {};
    const suggestionRows = [];

    allProps.forEach((p, i) => {
        if (p.isSuggestion) {
            suggestionRows.push({
                id: `property_${i + 1}_id_${String(p._id)}`,
                title: ('💡 ' + p.title).substring(0, 24),
                description: `📍 ${p.location} | 💰 ${formatCurrency(p.price)} | You might like this`.substring(0, 72),
            });
        } else {
            const key = p.type || 'other';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({ ...p, _idx: i + 1 });
        }
    });

    const sections = [];
    [...typeOrder, 'other'].forEach(type => {
        if (!grouped[type] || grouped[type].length === 0) return;
        sections.push({
            title: typeLabel[type] || '🏠 Properties',
            rows: grouped[type].map(p => ({
                id: `property_${p._idx}_id_${String(p._id)}`,
                title: p.title.substring(0, 24),
                description: `📍 ${p.location} | 💰 ${formatCurrency(p.price)}${p.matchScore ? ` | ⭐${p.matchScore}%` : ''}`.substring(0, 72),
            })),
        });
    });

    if (suggestionRows.length > 0) {
        sections.push({ title: '💡 You Might Also Like', rows: suggestionRows });
    }

    try {
        await whatsappService.sendInteractiveList(
            toPhone,
            headerText || `🏠 *Properties for you:*\n\nTap any property to see full details!`,
            `📋 View Properties`,
            sections
        );

        // Always offer Browse All after showing matches (1.5s delay so it feels like a follow-up)
        setTimeout(async () => {
            await whatsappService.sendInteractiveButtons(toPhone,
                `_Aur bhi properties dekhni hain? Browse all available listings! 👇_`,
                [
                    { id: 'browse_all', title: '📖 Browse All' },
                    { id: 'connect_agent', title: '📞 Talk to Agent' },
                ]
            ).catch(() => {});
        }, 1500);

        return true;
    } catch (e) {
        await whatsappService.sendTextMessage(toPhone,
            `🏠 *Properties for you:*\n\n${formatPropertyList(properties, suggestions)}\n\nReply with a number for full details!`
        );
        return false;
    }
};

module.exports = { matchProperties, formatPropertyList, sendPropertyInteractiveList, searchByQuery, scoreAndRank, getCatalogueProperties };
