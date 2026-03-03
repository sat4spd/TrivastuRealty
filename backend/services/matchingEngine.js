const Property = require('../models/Property');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../utils/logger');

const matchProperties = async (criteria) => {
    const { budget, location, propertyType } = criteria;
    const query = { status: 'approved', isAvailable: true };

    if (budget > 0) {
        query.price = { $gte: budget * 0.8, $lte: budget * 1.2 };
    }
    if (location) {
        query.location = { $regex: location, $options: 'i' };
    }
    if (propertyType) {
        query.type = propertyType;
    }

    let properties = await Property.find(query).sort({ price: 1 }).limit(10).lean();

    if (properties.length === 0 && budget > 0) {
        delete query.price;
        properties = await Property.find(query).sort({ price: 1 }).limit(5).lean();
    }

    if (properties.length === 0 && location) {
        delete query.location;
        query.price = { $gte: budget * 0.7, $lte: budget * 1.3 };
        properties = await Property.find(query).sort({ price: 1 }).limit(5).lean();
    }

    // Score results
    const scored = properties.map(p => {
        let score = 0;
        if (budget > 0) {
            const diff = Math.abs(p.price - budget) / budget;
            score += Math.max(0, (1 - diff)) * 40;
        }
        if (location && p.location.toLowerCase().includes(location.toLowerCase())) {
            score += 30;
        }
        if (propertyType && p.type === propertyType) {
            score += 20;
        }
        score += (p.amenities?.length || 0) * 2;
        return { ...p, matchScore: Math.round(score) };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, 5);
};

const formatPropertyList = (properties) => {
    if (!properties.length) {
        return "No matching properties found at the moment. We'll notify you when new listings match your criteria! 🔔";
    }

    return properties.map((p, i) =>
        `${i + 1}. *${p.title}*\n   📍 ${p.location}\n   💰 ${formatCurrency(p.price)}\n   🏠 ${p.type}${p.bedrooms ? ` | ${p.bedrooms} BHK` : ''}\n   📐 ${p.area || 'Contact for details'}\n   ⭐ Match: ${p.matchScore}%`
    ).join('\n\n');
};

module.exports = { matchProperties, formatPropertyList };
