const OpenAI = require('openai');
const Property = require('../models/Property');
const logger = require('../utils/logger');
const { formatCurrency } = require('../utils/helpers');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are the AI assistant for Trivastu Realty, a trusted real estate company based in Jharkhand, India.
We primarily serve customers looking for properties in Jharkhand — including Ranchi, Jamshedpur, Dhanbad, Bokaro, Hazaribagh, Deoghar, Dumka, Giridih, Ramgarh, Chaibasa, and surrounding areas.

RULES:
1. NEVER generate or modify property prices on your own. Only use prices from the provided data.
2. NEVER suggest modifications to property listings.
3. Always be professional, friendly, and helpful.
4. If you don't know something, say you'll connect them with an agent.
5. Recommend properties ONLY from the data provided to you.
6. Format responses for WhatsApp (use emojis, bold with *, keep it concise).
7. Respond in the same language the customer uses — support English, Hindi, Hinglish. Understand Bhojpuri and Santali greetings.
8. When customers mention a location without specifying a state, assume they mean Jharkhand.
9. Keep responses under 300 words.
10. For land/plot queries, use terms like 'decimal', 'acre', 'katha', 'bigha' which are common in Jharkhand.`;

const answerFAQ = async (question, context = '') => {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nProject Information:\n${context}` : '') },
                { role: 'user', content: question },
            ],
            max_tokens: 500,
            temperature: 0.7,
        });
        const answer = response.choices[0].message.content;
        logger.info('FAQ answered by AI');
        return answer;
    } catch (error) {
        logger.error('LLM FAQ error:', error.message);
        return "I'm having trouble processing your query right now. Let me connect you with our team. Please wait! 🙏";
    }
};

const recommendProperties = async (customerProfile) => {
    try {
        const budgetMin = customerProfile.budget * 0.8;
        const budgetMax = customerProfile.budget * 1.2;

        const query = { status: 'approved', isAvailable: true };
        if (customerProfile.budget > 0) {
            query.price = { $gte: budgetMin, $lte: budgetMax };
        }
        if (customerProfile.location) {
            query.location = { $regex: customerProfile.location, $options: 'i' };
        }
        if (customerProfile.propertyType) {
            query.type = customerProfile.propertyType;
        }

        const properties = await Property.find(query).sort({ price: 1 }).limit(10).lean();

        if (properties.length === 0) {
            const fallback = await Property.find({ status: 'approved', isAvailable: true })
                .sort({ createdAt: -1 }).limit(5).lean();

            if (fallback.length === 0) {
                return "We're currently updating our inventory. Our team will share the latest listings with you soon! 🏠";
            }

            const listings = fallback.map((p, i) =>
                `${i + 1}. *${p.title}*\n   📍 ${p.location}\n   💰 ${formatCurrency(p.price)}\n   🏠 ${p.type} | ${p.bedrooms} BHK\n   📐 ${p.area}`
            ).join('\n\n');

            return `We don't have exact matches for your criteria, but here are our latest listings:\n\n${listings}\n\nWould you like details on any of these? Reply with the number! 😊`;
        }

        // Score and rank
        const scored = properties.map(p => {
            let score = 0;
            const priceDiff = Math.abs(p.price - customerProfile.budget) / customerProfile.budget;
            score += (1 - priceDiff) * 50;
            if (customerProfile.location && p.location.toLowerCase().includes(customerProfile.location.toLowerCase())) score += 30;
            if (customerProfile.propertyType && p.type === customerProfile.propertyType) score += 20;
            return { ...p, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const top3 = scored.slice(0, 3);

        const prompt = `Based on this customer profile:
- Budget: ${formatCurrency(customerProfile.budget)}
- Location: ${customerProfile.location || 'Any'}
- Type: ${customerProfile.propertyType || 'Any'}

Here are the top matching properties:
${top3.map((p, i) => `${i + 1}. ${p.title} - ${formatCurrency(p.price)} at ${p.location}, ${p.type}, ${p.bedrooms} BHK, ${p.area}`).join('\n')}

Write a friendly WhatsApp recommendation message for each property, highlighting why each is a good match. Keep it concise with emojis.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            max_tokens: 600,
            temperature: 0.7,
        });

        logger.info('AI property recommendation generated');
        return response.choices[0].message.content;
    } catch (error) {
        logger.error('LLM recommendation error:', error.message);
        return "I'm working on finding the best properties for you. Our team will share recommendations shortly! 🏠";
    }
};

const generateResponse = async (userMessage, conversationHistory = []) => {
    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationHistory.slice(-5),
            { role: 'user', content: userMessage },
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            max_tokens: 400,
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    } catch (error) {
        logger.error('LLM response error:', error.message);
        return "Thanks for your message! Let me connect you with our team for the best assistance. 🙏";
    }
};

const parsePreferencesUpdate = async (userMessage, currentPreferences) => {
    try {
        const prompt = `You are a real estate AI assistant for Trivastu Realty.
The customer is currently looking for properties with these preferences:
${JSON.stringify(currentPreferences, null, 2)}

The customer just sent this message:
"${userMessage}"

Analyze if this message contains any changes to their real estate search preferences (budget, location, property type, or timeline).
If it's just a general question or greeting, return {"isUpdate": false}.
If they are updating their criteria, extract the new values. 
For budget, convert amounts to numerical INR (e.g., "50 lakhs" -> 5000000, "1.5 cr" -> 15000000). For type, use one of: apartment, villa, plot, commercial, farmhouse.

Return ONLY a valid, minified JSON object with this structure. Do NOT include any markdown blocks (like \`\`\`json) or other text.
{
  "isUpdate": boolean,
  "budget": number | null,
  "locationPreference": string | null,
  "propertyType": string | null,
  "timeline": string | null
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.1,
        });

        const jsonStr = response.choices[0].message.content.replace(/^```json/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(jsonStr);
        return parsed;
    } catch (error) {
        logger.error('LLM preference parsing error:', error.message);
        return { isUpdate: false };
    }
};

module.exports = { answerFAQ, recommendProperties, generateResponse, parsePreferencesUpdate };
