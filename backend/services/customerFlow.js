const User = require('../models/User');
const Lead = require('../models/Lead');
const whatsappService = require('./whatsappService');
const { matchProperties, formatPropertyList } = require('./matchingEngine');
const { notifyAdmin, ALERT_TYPES } = require('./notificationService');
const { recommendProperties, generateResponse, parsePreferencesUpdate } = require('./llmService');
const { formatCurrency, parsePhone } = require('../utils/helpers');
const logger = require('../utils/logger');

const STEPS = {
    WELCOME: 'welcome',
    ASK_NAME: 'ask_name',
    ASK_BUDGET: 'ask_budget',
    ASK_LOCATION: 'ask_location',
    ASK_MORE_LOCATIONS: 'ask_more_locations',
    ASK_TYPE: 'ask_type',
    ASK_TIMELINE: 'ask_timeline',
    COMPLETE: 'complete',
    MENU: 'menu',
};

const GREETINGS = ['hi', 'hello', 'hey', 'hii', 'hiii', 'namaste', 'good morning', 'good afternoon', 'good evening', 'start'];

// ── NEW CUSTOMER: First-time greeting ──
const handleNewCustomer = async (phone) => {
    const normalizedPhone = parsePhone(phone);

    let user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
        user = await User.create({
            phone: normalizedPhone,
            role: 'customer',
            conversationState: { flow: 'onboarding', step: STEPS.ASK_NAME, data: {} },
        });
    } else {
        user.conversationState = { flow: 'onboarding', step: STEPS.ASK_NAME, data: {} };
        await user.save();
    }

    await whatsappService.sendTextMessage(normalizedPhone,
        `🏠 *Welcome to Trivastu Realty!* 🏠\n\n` +
        `We're one of the fastest-growing real estate companies, helping you find your dream property.\n\n` +
        `I'm your personal assistant and I'll help you explore properties that match your needs.\n\n` +
        `To get started, please tell me your *full name*? 👤`
    );
};

// ── RETURNING CUSTOMER ──
const handleReturningCustomer = async (phone, user) => {
    const lastLead = await Lead.findOne({ customerId: user._id })
        .sort({ updatedAt: -1 })
        .populate('propertyId');

    let greeting = `👋 *Welcome back, ${user.name}!*\n\n`;

    if (lastLead) {
        greeting += `📋 Your last enquiry:\n`;
        if (lastLead.propertyId) {
            greeting += `🏠 ${lastLead.propertyId.title} - ${formatCurrency(lastLead.propertyId.price)}\n`;
        }
        greeting += `📍 Location: ${lastLead.location || user.locationPreference}\n`;
        greeting += `💰 Budget: ${formatCurrency(lastLead.budget || user.budget)}\n\n`;
    }

    greeting += `What would you like to do today?`;

    user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
    user.lastInteraction = new Date();
    await user.save();

    await whatsappService.sendInteractiveButtons(phone, greeting, [
        { id: 'cust_view_properties', title: '🏠 View Properties' },
        { id: 'cust_talk_agent', title: '👨‍💼 Talk to Agent' },
        { id: 'cust_ask_ai', title: '🤖 Ask AI' },
    ]);
};

// ── CUSTOMER MESSAGE HANDLER (onboarding + menu) ──
const handleCustomerMessage = async (phone, message, user) => {
    const state = user.conversationState;
    const text = message.trim();
    const lower = text.toLowerCase();

    // If user sends a greeting mid-flow, treat as greeting not data
    if (GREETINGS.includes(lower) && state.step !== STEPS.MENU) {
        // If user is in middle of onboarding and sends 'hi', show menu or restart
        if (user.name && user.name !== 'Unknown') {
            return handleReturningCustomer(phone, user);
        }
        // Otherwise continue — they're new
    }

    switch (state.step) {
        case STEPS.ASK_NAME: {
            // Validate name — must be at least 2 characters and not a greeting
            if (lower.length < 2 || GREETINGS.includes(lower)) {
                await whatsappService.sendTextMessage(phone,
                    `Please tell me your *full name* (e.g., Rajesh Kumar) 👤`
                );
                return;
            }
            user.name = text;
            user.conversationState.step = STEPS.ASK_BUDGET;
            await user.save();

            await whatsappService.sendTextMessage(phone,
                `Nice to meet you, *${text}*! 🤝\n\n` +
                `💰 What is your *budget* for the property?\n\n` +
                `You can type:\n` +
                `• _20L_ — for ₹20 Lakhs\n` +
                `• _50L_ — for ₹50 Lakhs\n` +
                `• _1Cr_ — for ₹1 Crore\n` +
                `• _1.5Cr_ — for ₹1.5 Crore`
            );
            break;
        }

        case STEPS.ASK_BUDGET: {
            const budget = parseBudget(text);
            if (budget <= 0) {
                await whatsappService.sendTextMessage(phone,
                    `I didn't quite catch that. Please enter your budget like:\n• 30L\n• 50L\n• 1Cr\n• 75L`
                );
                return;
            }
            user.budget = budget;
            user.conversationState.data.budget = budget;
            user.conversationState.step = STEPS.ASK_LOCATION;
            await user.save();

            await whatsappService.sendTextMessage(phone,
                `Great! Budget: *${formatCurrency(budget)}* ✅\n\n` +
                `📍 Which *location(s)* are you interested in?\n\n` +
                `You can mention *one or multiple* locations.\n` +
                `Example: _Bhopal, Singhmore, Indore_`
            );
            break;
        }

        case STEPS.ASK_LOCATION: {
            // Store locations (could be comma-separated)
            const locations = text.split(/[,;]/).map(l => l.trim()).filter(l => l.length > 1);
            if (locations.length === 0) {
                await whatsappService.sendTextMessage(phone,
                    `Please enter at least one location, e.g., _Bhopal_ or _Singhmore, Indore_`
                );
                return;
            }

            user.locationPreference = locations.join(', ');
            user.conversationState.data.locations = locations;
            user.conversationState.step = STEPS.ASK_TYPE;
            await user.save();

            await whatsappService.sendInteractiveButtons(phone,
                `📍 Location(s): *${locations.join(', ')}* ✅\n\n🏠 What *type of property* are you looking for?`,
                [
                    { id: 'type_apartment', title: '🏢 Apartment/Flat' },
                    { id: 'type_villa', title: '🏡 Villa/House' },
                    { id: 'type_plot', title: '🌳 Plot/Land' },
                ]
            );
            break;
        }

        case STEPS.ASK_TYPE: {
            let propertyType = resolvePropertyType(text);
            user.propertyType = propertyType;
            user.conversationState.data.propertyType = propertyType;
            user.conversationState.step = STEPS.ASK_TIMELINE;
            await user.save();

            await whatsappService.sendInteractiveButtons(phone,
                `🏠 Type: *${propertyType}* ✅\n\n⏰ When are you planning to purchase?`,
                [
                    { id: 'timeline_immediate', title: '🔥 Immediately' },
                    { id: 'timeline_3months', title: '📅 Within 3 months' },
                    { id: 'timeline_6months', title: '📆 6+ months' },
                ]
            );
            break;
        }

        case STEPS.ASK_TIMELINE: {
            let timeline = text;
            if (lower.includes('immediate') || lower.includes('now')) timeline = 'Immediately';
            else if (lower.includes('3')) timeline = 'Within 3 months';
            else if (lower.includes('6')) timeline = 'Within 6 months';
            else if (lower.includes('year') || lower.includes('12')) timeline = 'Within 1 year';

            user.timeline = timeline;
            user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
            await user.save();

            // Create lead
            const lead = await Lead.create({
                customerId: user._id,
                budget: user.budget,
                location: user.locationPreference,
                propertyType: user.propertyType,
                source: 'whatsapp',
            });

            // Notify admin
            await notifyAdmin(
                user.budget >= 5000000 ? ALERT_TYPES.HIGH_VALUE_LEAD : ALERT_TYPES.NEW_LEAD,
                {
                    name: user.name,
                    phone: user.phone,
                    budget: user.budget,
                    location: user.locationPreference,
                    propertyType: user.propertyType,
                }
            );

            // Smart match properties
            const matches = await matchProperties({
                budget: user.budget,
                location: user.locationPreference,
                propertyType: user.propertyType,
            });
            const listText = formatPropertyList(matches);

            await whatsappService.sendTextMessage(phone,
                `✅ *Registration Complete!*\n\n` +
                `📋 *Your Profile:*\n` +
                `👤 ${user.name}\n` +
                `📱 ${user.phone}\n` +
                `💰 ${formatCurrency(user.budget)}\n` +
                `📍 ${user.locationPreference}\n` +
                `🏠 ${user.propertyType}\n` +
                `⏰ ${timeline}\n\n` +
                (matches.length > 0
                    ? `🏠 *Matching Properties:*\n\n${listText}\n\nReply with a property *number* for details!`
                    : `We'll notify you when matching properties are available.`) +
                `\n\nType *MENU* anytime for options! 📋`
            );
            break;
        }

        case STEPS.MENU:
            await handleCustomerMenu(phone, text, user);
            break;

        default:
            user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
            await user.save();
            await handleCustomerMenu(phone, text, user);
    }
};

// ── CUSTOMER MENU ──
const handleCustomerMenu = async (phone, text, user) => {
    const lower = text.toLowerCase();

    if (GREETINGS.includes(lower) || lower === 'menu' || lower === 'options') {
        await whatsappService.sendInteractiveButtons(phone,
            `Hi *${user.name}*! 👋 How can I help you today?`,
            [
                { id: 'cust_view_properties', title: '🏠 View Properties' },
                { id: 'cust_talk_agent', title: '👨‍💼 Talk to Agent' },
                { id: 'cust_ask_ai', title: '🤖 Ask AI' },
            ]
        );
        return;
    }

    if (lower.includes('propert') || lower.includes('cust_view_properties') || lower === '1') {
        const matches = await matchProperties({
            budget: user.budget,
            location: user.locationPreference,
            propertyType: user.propertyType,
        });
        const listText = formatPropertyList(matches);

        if (matches.length === 0) {
            await whatsappService.sendTextMessage(phone,
                `Currently no properties match your criteria.\n\n` +
                `We'll notify you as soon as we get new listings! 🔔\n\nType *MENU* for more options.`
            );
        } else {
            await whatsappService.sendTextMessage(phone,
                `🏠 *Properties for you:*\n\n${listText}\n\n` +
                `Reply with the *number* (e.g., 1) for full details with photos! 📸\n\n` +
                `Type *MENU* for more options.`
            );
        }
        return;
    }

    // Property detail request (number 1-9)
    const numMatch = lower.match(/^(\d+)$/);
    if (numMatch) {
        const Property = require('../models/Property');
        const idx = parseInt(numMatch[1]) - 1;
        const matches = await matchProperties({
            budget: user.budget,
            location: user.locationPreference,
            propertyType: user.propertyType,
        });

        if (idx >= 0 && idx < matches.length) {
            const prop = matches[idx];
            let details = `🏠 *${prop.title}*\n\n` +
                `📍 Location: ${prop.location}\n` +
                `💰 Price: ${formatCurrency(prop.price)}\n` +
                `🏗 Type: ${prop.type}\n` +
                `📐 Area: ${prop.area || 'N/A'}\n` +
                `🛏 Bedrooms: ${prop.bedrooms || 'N/A'}\n` +
                `📝 ${prop.description || 'No description'}\n\n`;

            await whatsappService.sendTextMessage(phone, details);

            // Send property images if available
            if (prop.images && prop.images.length > 0) {
                const { getSignedUrl } = require('./s3Service');
                for (let i = 0; i < Math.min(prop.images.length, 3); i++) {
                    try {
                        const url = await getSignedUrl(prop.images[i]);
                        await whatsappService.sendMediaMessage(phone, 'image', url,
                            `${prop.title} - Photo ${i + 1}`);
                    } catch (err) {
                        logger.error('Failed to send property image:', err.message);
                    }
                }
            }

            // Send property videos if available
            if (prop.videos && prop.videos.length > 0) {
                const { getSignedUrl } = require('./s3Service');
                for (let i = 0; i < Math.min(prop.videos.length, 2); i++) {
                    try {
                        const url = await getSignedUrl(prop.videos[i]);
                        await whatsappService.sendMediaMessage(phone, 'video', url,
                            `${prop.title} - Video ${i + 1}`);
                    } catch (err) {
                        logger.error('Failed to send property video:', err.message);
                    }
                }
            }

            await whatsappService.sendInteractiveButtons(phone,
                `Interested in this property?`,
                [
                    { id: `schedule_visit_${prop._id}`, title: '📅 Schedule Visit' },
                    { id: 'cust_talk_agent', title: '📞 Talk to Agent' },
                    { id: 'cust_view_properties', title: '🔙 Back to List' },
                ]
            );
            return;
        }
    }

    // Schedule visit
    if (lower.includes('schedule_visit') || lower.includes('visit') || lower.includes('site visit')) {
        await whatsappService.sendTextMessage(phone,
            `📅 *Site Visit Request Received!*\n\n` +
            `Our team will contact you within 2 hours to schedule your visit.\n\n` +
            `👤 ${user.name}\n📱 ${user.phone}\n\nType *MENU* for more options.`
        );
        await notifyAdmin(ALERT_TYPES.SITE_VISIT_BOOKED, {
            name: user.name,
            phone: user.phone,
            budget: user.budget,
            location: user.locationPreference,
        });
        return;
    }

    if (lower.includes('agent') || lower.includes('cust_talk_agent') || lower === '2') {
        await whatsappService.sendTextMessage(phone,
            `👨‍💼 *Agent Request Submitted!*\n\nOur best agent will reach out to you shortly. 📞\n\nType *MENU* for more options.`
        );
        await notifyAdmin(ALERT_TYPES.NEW_LEAD, {
            name: user.name, phone: user.phone, budget: user.budget,
            location: user.locationPreference, propertyType: 'Agent requested',
        });
        return;
    }

    if (lower.includes('ai') || lower.includes('cust_ask_ai') || lower === '3') {
        user.conversationState.data.aiMode = true;
        await user.save();
        await whatsappService.sendTextMessage(phone,
            `🤖 *AI Assistant Activated!*\n\n` +
            `Ask me anything about:\n` +
            `• Properties & pricing\n` +
            `• Area details & amenities\n` +
            `• Investment advice\n\n` +
            `Type *MENU* to go back.`
        );
        return;
    }

    // Fast check for preference update using LLM
    if (state.step === STEPS.MENU && !user.conversationState.data?.aiMode && text.length > 5 && !lower.includes('cust_')) {
        const currentPrefs = {
            budget: user.budget,
            locationPreference: user.locationPreference,
            propertyType: user.propertyType,
            timeline: user.timeline
        };

        const prefsUpdate = await parsePreferencesUpdate(text, currentPrefs);

        if (prefsUpdate && prefsUpdate.isUpdate) {
            let updated = false;
            let changes = [];

            if (prefsUpdate.budget && prefsUpdate.budget !== user.budget) {
                user.budget = prefsUpdate.budget;
                changes.push(`💰 Budget: ${formatCurrency(prefsUpdate.budget)}`);
                updated = true;
            }
            if (prefsUpdate.locationPreference && prefsUpdate.locationPreference !== user.locationPreference) {
                user.locationPreference = prefsUpdate.locationPreference;
                changes.push(`📍 Location: ${prefsUpdate.locationPreference}`);
                updated = true;
            }
            if (prefsUpdate.propertyType && prefsUpdate.propertyType !== user.propertyType) {
                user.propertyType = prefsUpdate.propertyType;
                changes.push(`🏠 Type: ${prefsUpdate.propertyType}`);
                updated = true;
            }
            if (prefsUpdate.timeline && prefsUpdate.timeline !== user.timeline) {
                user.timeline = prefsUpdate.timeline;
                changes.push(`⏱ Timeline: ${prefsUpdate.timeline.replace('_', ' ')}`);
                updated = true;
            }

            if (updated) {
                await user.save();
                await whatsappService.sendTextMessage(phone,
                    `✅ *Preferences Updated!*\n\nI have automatically updated your search criteria:\n` +
                    changes.map(c => `• ${c}`).join('\n') +
                    `\n\nI will notify our agents to look for properties matching these new details. Type *MENU* to see options.`
                );

                // Also update admin
                await notifyAdmin(ALERT_TYPES.CUSTOMER_UPDATED_PREFS || 'CUSTOMER_PREFS_UPDATED', {
                    name: user.name,
                    phone: user.phone,
                    budget: user.budget,
                    location: user.locationPreference
                });
                return;
            }
        }
    }

    if (lower === 'update' || lower === 'edit' || lower === 'change preferences') {
        user.conversationState = { flow: 'onboarding', step: STEPS.ASK_BUDGET, data: {} };
        await user.save();
        await whatsappService.sendTextMessage(phone,
            `Let's update your preferences! 📝\n\n💰 What is your *new budget*?`
        );
        return;
    }

    // AI mode — pass to LLM
    if (user.conversationState.data?.aiMode) {
        try {
            const aiResponse = await generateResponse(text);
            await whatsappService.sendTextMessage(phone, `🤖 ${aiResponse}\n\nType *MENU* to go back.`);
        } catch (err) {
            await whatsappService.sendTextMessage(phone, `Sorry, AI is unavailable right now. Type *MENU* for options.`);
        }
        return;
    }

    // Default: send to AI
    try {
        const response = await generateResponse(text);
        await whatsappService.sendTextMessage(phone, `🤖 ${response}\n\nType *MENU* for options.`);
    } catch (err) {
        await whatsappService.sendTextMessage(phone,
            `I didn't understand that. Type *MENU* to see options, or ask me anything! 🤖`
        );
    }
};

// ── HELPERS ──

// Hindi/Regional greetings
const GREETINGS_MULTI = [
    'hi', 'hello', 'hey', 'hii', 'hiii', 'namaste', 'namaskar',
    'good morning', 'good afternoon', 'good evening',
    'start', 'hlo', 'hlw', 'namaskaar', 'pranam',
    'kaise ho', 'kya haal', 'jai shri ram', 'radhe radhe',
];

const resolvePropertyType = (text) => {
    const lower = text.toLowerCase();
    // English
    if (lower.includes('apartment') || lower.includes('flat')) return 'apartment';
    if (lower.includes('villa') || lower.includes('house') || lower.includes('bungalow')) return 'villa';
    if (lower.includes('plot') || lower.includes('land')) return 'plot';
    if (lower.includes('commercial') || lower.includes('shop') || lower.includes('office')) return 'commercial';
    if (lower.includes('farm') || lower.includes('agriculture')) return 'farmhouse';
    // Hindi
    if (lower.includes('flat') || lower.includes('फ्लैट')) return 'apartment';
    if (lower.includes('मकान') || lower.includes('ghar') || lower.includes('घर')) return 'villa';
    if (lower.includes('जमीन') || lower.includes('zameen') || lower.includes('ज़मीन') || lower.includes('भूखंड')) return 'plot';
    if (lower.includes('दुकान') || lower.includes('dukaan') || lower.includes('ऑफिस')) return 'commercial';
    if (lower.includes('खेत') || lower.includes('फार्म')) return 'farmhouse';
    return text;
};

/**
 * Smart Budget Parser — Real estate context aware
 * "50" → ₹50 Lakhs (in real estate, bare numbers assumed as Lakhs)
 * "50L" → ₹50 Lakhs
 * "1.5Cr" → ₹1.5 Crore
 * "5000000" → ₹50 Lakhs
 * Hindi: "pachaas lakh" → ₹50 Lakhs
 */
const parseBudget = (text) => {
    let input = text.toLowerCase()
        .replace(/,/g, '')
        .replace(/₹/g, '')
        .replace(/rs\.?\s*/gi, '')
        .replace(/rupees?\s*/gi, '')
        .replace(/inr\s*/gi, '')
        .trim();

    // Hindi word numbers → digits
    const hindiNumbers = {
        'ek': 1, 'do': 2, 'teen': 3, 'chaar': 4, 'paanch': 5, 'panch': 5,
        'chhah': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
        'bees': 20, 'tees': 30, 'chaalees': 40, 'pachaas': 50, 'pachis': 25,
        'saath': 60, 'sattar': 70, 'assi': 80, 'nabbe': 90, 'sau': 100,
        'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5,
        'दस': 10, 'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50,
        'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90, 'सौ': 100,
    };

    // Replace Hindi number words with digits
    for (const [word, num] of Object.entries(hindiNumbers)) {
        if (input.includes(word)) {
            input = input.replace(word, String(num));
        }
    }

    // Hindi unit words
    input = input
        .replace(/करोड़|karod|crore/gi, 'cr')
        .replace(/लाख|lakh|lac/gi, 'l')
        .replace(/हज़ार|हजार|hazaar|hazar|thousand/gi, 'k');

    let amount = 0;

    // Match patterns: "1.5cr", "50l", "500k"
    const crMatch = input.match(/([\d.]+)\s*cr/);
    const lMatch = input.match(/([\d.]+)\s*l/);
    const kMatch = input.match(/([\d.]+)\s*k/);
    const numMatch = input.match(/([\d.]+)/);

    if (crMatch) {
        amount = parseFloat(crMatch[1]) * 10000000;
    } else if (lMatch) {
        amount = parseFloat(lMatch[1]) * 100000;
    } else if (kMatch) {
        amount = parseFloat(kMatch[1]) * 1000;
    } else if (numMatch) {
        amount = parseFloat(numMatch[1]);

        // Smart inference for real estate context:
        if (amount >= 10000000) {
            // Already in absolute (1Cr+), keep as-is
        } else if (amount >= 100000) {
            // Looks like absolute value (e.g., 5000000 = 50L), keep as-is
        } else if (amount >= 100) {
            // Could be "500" meaning 500? In real estate → assume thousands
            // But 5000 could mean 5000 or 50L — keep as-is if > 1000
            if (amount >= 1000) {
                // Assume thousands or keep as-is (user might mean 5000 rupees)
            }
        } else {
            // Small number (1-99) → MUST be in Lakhs for real estate
            // "50" → 50 Lakhs, "1" → 1 Lakh, "2.5" → 2.5 Lakhs
            amount = amount * 100000;
        }
    }

    return amount;
};

/**
 * Detect if the message is in Hindi (Devanagari) or English
 */
const detectLanguage = (text) => {
    const devanagariRegex = /[\u0900-\u097F]/;
    if (devanagariRegex.test(text)) return 'hi';
    // Check for Hinglish common words
    const hinglishWords = ['kya', 'hai', 'mujhe', 'chahiye', 'ghar', 'zameen',
        'kitna', 'kahan', 'batao', 'dikhao', 'bhai', 'ji', 'acha', 'theek',
        'haan', 'nahi', 'nhi', 'kaise', 'kab', 'abhi', 'baad'];
    const words = text.toLowerCase().split(/\s+/);
    const hinglishCount = words.filter(w => hinglishWords.includes(w)).length;
    if (hinglishCount >= 2 || hinglishCount / words.length > 0.3) return 'hi';
    return 'en';
};

module.exports = { handleNewCustomer, handleReturningCustomer, handleCustomerMessage };

