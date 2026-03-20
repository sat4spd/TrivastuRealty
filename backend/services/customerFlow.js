const User = require('../models/User');
const Lead = require('../models/Lead');
const Property = require('../models/Property');
const whatsappService = require('./whatsappService');
const { searchByQuery, formatPropertyList, sendPropertyInteractiveList } = require('./matchingEngine');

const { notifyAdmin, ALERT_TYPES } = require('./notificationService');
const { formatCurrency, parsePhone } = require('../utils/helpers');
const {
    detectIntent,
    extractEntities,
    generateResponse,
    parsePreferencesUpdate,
    INTENTS
} = require('./llmService');
const logger = require('../utils/logger');

const STEPS = {
    WELCOME: 'welcome',
    ASK_NAME: 'ask_name',
    ASK_BUDGET: 'ask_budget',
    ASK_LOCATION: 'ask_location',
    ASK_TYPE: 'ask_type',
    ASK_TIMELINE: 'ask_timeline',
    MENU: 'menu',
};

// ── CUSTOMER IMAGE (VISUAL DISCOVERY) ──
const handleCustomerImage = async (phone, imageBuffer, user) => {
    try {
        await whatsappService.sendTextMessage(phone, `📸 I received your image! Let me analyze it and find similar properties for you... 🔍`);

        // Convert buffer to base64 for OpenAI Vision API
        const base64Image = imageBuffer.toString('base64');
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Must use 4o for vision
            messages: [
                {
                    role: "system",
                    content: "You are an expert real estate AI. Analyze this image (it could be a house, floor plan, or room). Describe what kind of property it is, the vibe, and extract key searchable features (e.g. 'modern apartment', 'duplex villa', 'swimming pool', 'spacious balcony'). Keep it under 2 sentences."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What kind of property is this?" },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" } }
                    ]
                }
            ],
            max_tokens: 150,
        });

        const imageAnalysis = response.choices[0].message.content;
        user.addToHistory('user', "[Sent an Image]");
        user.addToHistory('assistant', `[AI Vision Analysis]: ${imageAnalysis}`);
        await user.save();

        // Feed the analysis back into the smart search to find matches
        const fakeMessage = `I want a property that looks like this: ${imageAnalysis}`;
        return handleSmartMessage(phone, fakeMessage, user);

    } catch (e) {
        logger.error('Vision API Error:', e.message);
        await whatsappService.sendTextMessage(phone, `Sorry, I couldn't analyze the image right now. Please tell me what you're looking for in words!`);
    }
};

// ── NEW CUSTOMER: First-time greeting with Freeze Timer ──
const handleNewCustomer = async (phone, initialMessage = '') => {
    const normalizedPhone = parsePhone(phone);
    const { ensurePendingLead, startFreezeTimer } = require('./leadFreezeService');

    let user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
        user = await User.create({
            phone: normalizedPhone,
            role: 'customer',
            conversationState: { flow: 'onboarding', step: STEPS.ASK_NAME, data: {} },
        });
    } else if (!user.conversationState?.step) {
        user.conversationState = { flow: 'onboarding', step: STEPS.ASK_NAME, data: {} };
        await user.save();
    }

    // Silently create a partial lead + start 10-min freeze timer before admin notification
    await ensurePendingLead(normalizedPhone, initialMessage, 'whatsapp');

    // If user asked something specific (not a generic greeting), answer it first
    const lower = initialMessage.toLowerCase().trim();
    const isGenericGreeting = !initialMessage || ['hi', 'hello', 'hey', 'hlo', 'namaste', 'start', ''].includes(lower);

    if (!isGenericGreeting && initialMessage.length > 5) {
        // They asked a real question — answer it naturally, THEN casually ask name
        const intent = await detectIntent(initialMessage, user.conversationHistory || []);

        // Generate a natural language response to their question
        const aiResponse = await generateResponse(
            `You are ARIA, a friendly AI assistant for Trivastu Realty in Jharkhand. ` +
            `A new user just messaged: "${initialMessage}". ` +
            `Answer their question helpfully and naturally in the same language they used (Hindi or English). ` +
            `End with casually asking for their name in a friendly way. ` +
            `Keep it concise, under 120 words. Include relevant emojis.`,
            user.conversationHistory || []
        );

        user.addToHistory('user', initialMessage);
        user.addToHistory('assistant', aiResponse);
        user.conversationState = { flow: 'onboarding', step: STEPS.ASK_NAME, data: {} };
        await user.save();

        await whatsappService.sendTextMessage(normalizedPhone, aiResponse);

        // ── INTENT-BASED INSTANT PROMOTION ──
        // If they already gave us budget/location in message 1, don't wait 10 mins. Promote immediately!
        const { extractEntities } = require('./llmService');
        const entities = await extractEntities(initialMessage);
        
        if (entities.budget || entities.location || entities.propertyType) {
            const { updatePendingLead, promoteLeadToAdmin, cancelFreezeTimer } = require('./leadFreezeService');
            
            logger.info(`🔥 High Intent Detected in first message from ${normalizedPhone}. Promoting lead instantly.`);
            
            // Update the pending lead with the extracted info
            await updatePendingLead(normalizedPhone, {
                budget: entities.budget,
                location: entities.location,
                propertyType: entities.propertyType
            });
            
            // Cancel the 10-min timer and notify admin immediately
            cancelFreezeTimer(normalizedPhone);
            await promoteLeadToAdmin(normalizedPhone);
        }

    } else {
        // Generic greeting — send the native WhatsApp Flow form immediately
        const welcomeMsg = `🏠 *Welcome to Trivastu Realty!*

Ham Jharkhand ki trusted real estate company hain.

Kindly fill the quick form below — main aapke liye best property options dhundhunga/dhundhugi! 🙏`;

        user.addToHistory('assistant', welcomeMsg);
        user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
        await user.save();

        // First send a warm text, then send the flow form
        await whatsappService.sendTextMessage(normalizedPhone, welcomeMsg);
        await new Promise(r => setTimeout(r, 800));
        await whatsappService.sendFlowMessage(normalizedPhone, {
            headerText: 'Trivastu Realty 🏠',
            bodyText: 'Tell us your property requirement in under 1 minute and our advisor will find the perfect match for you!',
            ctaText: '📝 Fill My Details',
        });
    }
};

// ── WHATSAPP FLOW FORM SUBMISSION HANDLER ──
// Called from webhook.js when user submits the native WhatsApp Flow form (nfm_reply)
// flowData is the payload from the CONFIRM screen's 'complete' action
const handleFlowSubmission = async (phone, flowData) => {
    const normalizedPhone = parsePhone(phone);
    const { updatePendingLead, promoteLeadToAdmin, cancelFreezeTimer, ensurePendingLead } = require('./leadFreezeService');

    // Map Meta Flow dropdown IDs to human-readable/db values
    const BUDGET_MAP = { '10L': 1000000, '20L': 2000000, '50L': 5000000, '1CR': 10000000 };
    const LOC_MAP = { ranchi: 'Ranchi', khunti: 'Khunti', nagari: 'Nagari', namkum: 'Namkum', other: flowData.other_location || 'Other' };

    const name         = flowData.name?.trim();
    const budget       = BUDGET_MAP[flowData.budget] || null;
    const location     = LOC_MAP[flowData.location] || flowData.location || 'Not specified';
    const propertyType = Array.isArray(flowData.property_type)
                            ? flowData.property_type.join(', ')
                            : (flowData.property_type || 'Not specified');
    const timeline     = flowData.timeline || 'Not specified';
    const marketing    = flowData.marketing_optin === true || flowData.marketing_optin === 'true';

    logger.info(`📋 Flow form submitted from ${normalizedPhone}: ${name} | ${budget} | ${location} | ${propertyType}`);

    // Update or create user profile
    let user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
        user = await User.create({ phone: normalizedPhone, role: 'customer', conversationState: { flow: 'onboarding', step: STEPS.MENU, data: {} } });
    }
    if (name) user.name = name;
    if (budget) user.budget = budget;
    if (location) user.locationPreference = location;
    if (propertyType) user.propertyType = propertyType.split(',')[0].trim();
    if (!marketing) user.marketingOptOut = true;
    await user.save();

    // Ensure lead exists and update it with full form data, then promote immediately
    await ensurePendingLead(normalizedPhone, `Flow form submission: ${name}`, 'whatsapp');
    await updatePendingLead(normalizedPhone, { name, budget, location, propertyType, timeline });
    cancelFreezeTimer(normalizedPhone);
    await promoteLeadToAdmin(normalizedPhone);

    // Send confirmation message to user
    const confirmMsg = `✅ *Shukriya, ${name || 'aap'}!*

Aapki details successfully receive ho gayi hain.
📞 Hamara advisor *24 ghante mein* aapse connect karega.

Tab tak, kya aap kuch properties explore karna chahenge? 🏠`;

    await whatsappService.sendInteractiveButtons(normalizedPhone, confirmMsg, [
        { id: 'view_properties', title: '🏠 See Properties' },
        { id: 'connect_agent',   title: '📞 Talk to Agent' },
    ]);
};

// ── IN-WHATSAPP LEAD CAPTURE FORM (Q1 → Q5) ──
// Drives a conversational form — same UX as the admin menu, no browser needed
const FORM_STEPS = {
    1: { field: 'name',         type: 'text' },
    2: { field: 'budget',       type: 'buttons', options: [
        { id: 'budget_u20',  title: 'Under ₹20 Lakh' },
        { id: 'budget_2050', title: '₹20L – ₹50L' },
        { id: 'budget_501cr', title: '₹50L – ₹1 Cr' },
        { id: 'budget_1cr',  title: 'Above ₹1 Cr' },
    ]},
    3: { field: 'location',     type: 'buttons', options: [
        { id: 'loc_ranchi',    title: 'Ranchi' },
        { id: 'loc_tupudana',  title: 'Tupudana' },
        { id: 'loc_nagri',     title: 'Nagri / Lodhma' },
        { id: 'loc_other',     title: 'Other / Not sure' },
    ]},
    4: { field: 'propertyType', type: 'buttons', options: [
        { id: 'type_plot',      title: '🌿 Plot / Land' },
        { id: 'type_house',     title: '🏠 House / Villa' },
        { id: 'type_apartment', title: '🏢 Apartment' },
        { id: 'type_commercial',title: '🏪 Commercial' },
    ]},
    5: { field: 'timeline',     type: 'buttons', options: [
        { id: 'time_now',      title: '⚡ Immediately' },
        { id: 'time_3m',       title: '3 Months' },
        { id: 'time_6m',       title: '6 Months' },
        { id: 'time_1yr',      title: 'Over a Year' },
    ]},
};

const FORM_QUESTIONS = {
    1: 'Aapka naam kya hai? 😊',
    2: 'Aapka approximate budget kya hai?',
    3: 'Aap kahan property dhundh rahe hain?',
    4: 'Aapko kaunsa property type chahiye?',
    5: 'Aap kab tak purchase karna chahte hain?',
};

const BUDGET_MAP = {
    'budget_u20': 2000000,   // 20L
    'budget_2050': 3500000,  // ~35L mid
    'budget_501cr': 7500000, // ~75L mid
    'budget_1cr': 15000000,  // 1.5Cr
};

const handleLeadForm = async (phone, user, text) => {
    const normalizedPhone = parsePhone(phone);
    const state = user.conversationState;
    const formStep = state.data?.formStep || 1;
    const formData = state.data?.formData || {};

    // Save the answer from the previous step
    if (formStep > 1) {
        const prevStep = FORM_STEPS[formStep - 1];
        if (prevStep.field === 'name') {
            formData.name = text;
            user.name = text.trim();
        } else if (prevStep.field === 'budget') {
            formData.budget = BUDGET_MAP[text] || null;
        } else if (prevStep.field === 'location') {
            const locMap = { loc_ranchi: 'Ranchi', loc_tupudana: 'Tupudana', loc_nagri: 'Nagri / Lodhma', loc_other: 'Other' };
            formData.location = locMap[text] || text;
        } else if (prevStep.field === 'propertyType') {
            const typeMap = { type_plot: 'plot', type_house: 'villa', type_apartment: 'apartment', type_commercial: 'commercial' };
            formData.propertyType = typeMap[text] || text;
        } else if (prevStep.field === 'timeline') {
            const timeMap = { time_now: 'immediate', time_3m: '3_months', time_6m: '6_months', time_1yr: '1_year' };
            formData.timeline = timeMap[text] || text;
        }
    }

    // If all 5 questions answered → promote lead
    if (formStep > 5) {
        const { updatePendingLead, promoteLeadToAdmin } = require('./leadFreezeService');
        await updatePendingLead(normalizedPhone, {
            name: formData.name,
            budget: formData.budget,
            location: formData.location,
            propertyType: formData.propertyType,
            timeline: formData.timeline,
        });
        if (formData.name) { user.name = formData.name; }
        if (formData.budget) { user.budget = formData.budget; }
        if (formData.location) { user.locationPreference = formData.location; }
        if (formData.propertyType) { user.propertyType = formData.propertyType; }

        await promoteLeadToAdmin(normalizedPhone);

        user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
        await user.save();

        await whatsappService.sendInteractiveButtons(
            normalizedPhone,
            `✅ *Shukriya, ${formData.name || 'aap'}!*\n\nAapki details save ho gayi hain. Hamara advisor jald aapse connect karega.\n\nTab tak, kya main aapko kuch properties dikhaoon?`,
            [
                { id: 'view_properties', title: '🏠 See Properties' },
                { id: 'connect_agent',   title: '📞 Talk to Agent' },
            ]
        );
        return;
    }

    // Ask the current question
    const currentStep = FORM_STEPS[formStep];
    const question = FORM_QUESTIONS[formStep];

    user.conversationState = { flow: 'in_form', step: 'form', data: { formStep: formStep + 1, formData } };
    await user.save();

    if (currentStep.type === 'buttons') {
        await whatsappService.sendInteractiveButtons(normalizedPhone, question, currentStep.options);
    } else {
        await whatsappService.sendTextMessage(normalizedPhone, question);
    }
};

const handleReturningCustomer = async (phone, user) => {
    const lastLead = await Lead.findOne({ customerId: user._id })
        .sort({ updatedAt: -1 })
        .populate('propertyId');

    let greeting = `👋 *Welcome back, ${user.name}!*\n\n`;

    if (lastLead && lastLead.budget > 0) {
        greeting += `📋 Your last enquiry:\n`;
        if (lastLead.propertyId) {
            greeting += `🏠 ${lastLead.propertyId.title} - ${formatCurrency(lastLead.propertyId.price)}\n`;
        }
        greeting += `📍 Location: ${lastLead.location || user.locationPreference}\n`;
        greeting += `💰 Budget: ${formatCurrency(lastLead.budget || user.budget)}\n\n`;
    }

    greeting += `What would you like to explore today? You can ask me anything about properties, locations, or simply tell me your new requirements.`;

    user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
    user.lastInteraction = new Date();
    user.addToHistory('assistant', greeting);
    await user.save();

    await whatsappService.sendInteractiveButtons(phone, greeting, [
        { id: 'view_my_matches', title: '🏠 View My Matches' },
        { id: 'schedule_call', title: '📞 Request Call' },
    ]);
};

// ── MAIN CUSTOMER MESSAGE HANDLER ──
const handleCustomerMessage = async (phone, message, user) => {
    const state = user.conversationState;
    const text = message.trim();

    // 4-Hour Session Timeout: clear old conversation history so AI doesn't get confused
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    if (user.lastInteraction && (new Date() - new Date(user.lastInteraction)) > FOUR_HOURS) {
        user.conversationHistory = [];
        logger.info(`🧹 Resetting 4-hour chat session history for ${phone}`);
    }

    // Log message
    user.addToHistory('user', text);

    // ── ROUTE: In-WhatsApp Lead Form ──
    if (state.flow === 'in_form') {
        return handleLeadForm(phone, user, text);
    }

    // If still in onboarding flow
    if (state.step && state.step !== STEPS.MENU) {
        return handleOnboardingStep(phone, text, user);
    }

    const lower = text.toLowerCase();
    if (['menu', 'hi', 'hello', 'hey', 'start', 'hlo', 'namaste'].includes(lower)) {
        return handleReturningCustomer(phone, user);
    }

    // Default to Smart Intent Handler
    return handleSmartMessage(phone, text, user);
};

// ── ONBOARDING FLOW ──
const handleOnboardingStep = async (phone, text, user) => {
    const lower = text.toLowerCase();
    const state = user.conversationState;

    if (['menu', 'hi', 'hello', 'hey', 'start', 'hlo', 'namaste', 'cancel'].includes(lower)) {
        return handleReturningCustomer(phone, user);
    }

    // Safety hatch out of onboarding if they ask something complex
    if (state.step !== STEPS.ASK_NAME && text.length > 20) {
        // Assume they skipped standard answers and gave a full sentence
        const entities = await extractEntities(text);
        if (entities.budget || entities.location || entities.propertyType) {
            if (entities.budget) user.budget = entities.budget;
            if (entities.location) user.locationPreference = entities.location;
            if (entities.propertyType) user.propertyType = entities.propertyType;

            user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
            await user.save();
            return handleSmartMessage(phone, text, user);
        }
    }

    switch (state.step) {
        case STEPS.ASK_NAME: {
            if (lower.length < 2 || ['hi', 'hello'].includes(lower)) {
                await sendAndSave(phone, user, `Please tell me your *full name* (e.g., Rajesh Kumar) 👤`);
                return;
            }
            user.name = text;
            user.conversationState.step = STEPS.ASK_BUDGET;
            await user.save();

            await sendAndSave(phone, user,
                `Nice to meet you, *${text}*! 🤝\n\n` +
                `💰 What is your *budget* for the property?\n\n` +
                `(e.g., 20L, 50 Lakhs, 1.5Cr)`
            );
            break;
        }

        case STEPS.ASK_BUDGET: {
            // First check if they said something like "50 lakhs for a plot in Tupudana"
            const entities = await extractEntities(text);

            let budget = entities.budget || parseBudgetSimple(text);

            if (budget <= 0) {
                await sendAndSave(phone, user, `I didn't quite catch that. Please enter your budget like: 30L, 50 Lakhs, or 1Cr`);
                return;
            }

            user.budget = budget;
            user.conversationState.data.budget = budget;
            user.conversationState.step = STEPS.ASK_LOCATION;

            // If we extracted other things, save them too
            if (entities.location) user.locationPreference = entities.location;
            if (entities.propertyType) user.propertyType = entities.propertyType;

            await user.save();

            if (user.locationPreference) {
                // Skip asking location if they already provided it
                user.conversationState.step = STEPS.ASK_TYPE;
                await user.save();
                await sendInteractiveAndSave(phone, user,
                    `Got it! Budget: *${formatCurrency(budget)}*, Location: *${user.locationPreference}* ✅\n\n🏠 What *type of property* are you looking for?`,
                    [
                        { id: 'type_apartment', title: '🏢 Apartment/Flat' },
                        { id: 'type_villa', title: '🏡 Villa/House' },
                        { id: 'type_plot', title: '🌳 Plot/Land' },
                    ]
                );
            } else {
                await sendAndSave(phone, user,
                    `Great! Budget: *${formatCurrency(budget)}* ✅\n\n` +
                    `📍 Which *location(s)* in Jharkhand are you interested in?\n(e.g., Ranchi, Tupudana, Jamshedpur)`
                );
            }
            break;
        }

        case STEPS.ASK_LOCATION: {
            // They might say "Tupudana and Nagri"
            const entities = await extractEntities(text);
            const location = entities.location || text;

            if (location.length < 3) {
                await sendAndSave(phone, user, `Please enter a valid location (e.g., _Ranchi_ or _Tupudana_)`);
                return;
            }

            user.locationPreference = location;
            user.conversationState.step = STEPS.ASK_TYPE;

            if (entities.propertyType) user.propertyType = entities.propertyType;

            await user.save();

            if (user.propertyType) {
                user.conversationState.step = STEPS.ASK_TIMELINE;
                await user.save();
                await sendInteractiveAndSave(phone, user,
                    `📍 Location: *${location}* ✅\n🏠 Type: *${user.propertyType}* ✅\n\n⏰ When are you planning to purchase?`,
                    [
                        { id: 'timeline_immediate', title: '🔥 Immediately' },
                        { id: 'timeline_3months', title: '📅 Within 3 months' },
                        { id: 'timeline_6months', title: '📆 6+ months' },
                    ]
                );
            } else {
                await sendInteractiveAndSave(phone, user,
                    `📍 Location: *${location}* ✅\n\n🏠 What *type of property* are you looking for?`,
                    [
                        { id: 'type_apartment', title: '🏢 Apartment/Flat' },
                        { id: 'type_villa', title: '🏡 Villa/House' },
                        { id: 'type_plot', title: '🌳 Plot/Land' },
                    ]
                );
            }
            break;
        }

        case STEPS.ASK_TYPE: {
            const entities = await extractEntities(text);
            const pType = entities.propertyType || resolvePropertyTypeLegacy(text);

            user.propertyType = pType;
            user.conversationState.step = STEPS.ASK_TIMELINE;
            await user.save();

            await sendInteractiveAndSave(phone, user,
                `🏠 Type: *${pType}* ✅\n\n⏰ When are you planning to purchase?`,
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

            user.timeline = timeline;
            user.conversationState = { flow: 'onboarding', step: STEPS.MENU, data: {} };
            await user.save();

            // Calculate initial AI Score
            const { calculateLeadScore } = require('./leadScoringEngine');
            const scoreData = calculateLeadScore({ budget: user.budget, propertyType: user.propertyType }, user);

            // Create lead
            const newLead = await Lead.create({
                customerId: user._id,
                budget: user.budget,
                location: user.locationPreference,
                propertyType: user.propertyType,
                source: 'whatsapp',
                aiScore: scoreData.aiScore,
                urgency: scoreData.urgency,
                buyerPersona: scoreData.buyerPersona,
            });

            // Attempt automatic agent assignment based on location and load
            const { assignAgentToLead } = require('./assignmentEngine');
            const assignedAgentId = await assignAgentToLead(newLead);

            // Notify admin
            await notifyAdmin(
                user.budget >= 5000000 ? ALERT_TYPES.HIGH_VALUE_LEAD : ALERT_TYPES.NEW_LEAD,
                {
                    name: user.name, phone: user.phone, budget: user.budget,
                    location: user.locationPreference, propertyType: user.propertyType,
                    aiScore: scoreData.aiScore,
                    assignedTo: assignedAgentId || 'Unassigned',
                }
            );

            // Fetch matching properties instantly
            const { properties: matches, matchTier } = await searchByQuery({
                budget: user.budget,
                location: user.locationPreference,
                propertyType: user.propertyType,
            });

            // Update search context so follow-ups work
            user.lastSearchContext = {
                budget: user.budget,
                location: user.locationPreference,
                propertyType: user.propertyType,
                updatedAt: new Date()
            };
            await user.save();

            const completionMsg = `✅ *Registration Complete!*\n\n📋 *Your Profile:*\n👤 ${user.name}\n💰 ${formatCurrency(user.budget)}\n📍 ${user.locationPreference}\n🏠 ${user.propertyType}\n\nGreat! Let me show you the best matching properties now 👇`;
            await sendAndSave(phone, user, completionMsg);

            if (matches.length > 0) {
                if (matchTier === 'relaxed_budget') {
                    await sendAndSave(phone, user, `🔍 I couldn't find exact matches under your budget, but here are some great options slightly higher...`);
                } else if (matchTier === 'location_only') {
                    await sendAndSave(phone, user, `🔍 We don't have exactly what you asked for, but here are some options in ${user.locationPreference}... \n\n🌐 Explore all properties at https://realty.trivastu.com`);
                } else if (matchTier === 'general') {
                    await sendAndSave(phone, user, `🔍 I couldn't find exact matches in your location, but here are our newest properties... \n\n🌐 Explore everything at https://realty.trivastu.com`);
                }
                await sendPropertyInteractiveList(phone, matches);
            } else {
                await sendAndSave(phone, user, `I'll alert my team and notify you when matching properties arrive. Let me know if you want to change any preferences or ask a question!`);
            }
            break;
        }
    }
};

// ── SMART INTENT HANDLER ──
// Used for all messages after onboarding is complete.
const handleSmartMessage = async (phone, text, user) => {
    // 1. Interactive button clicks (id-based)
    // Handle property_N taps from the interactive property list
    const propertyTapMatch = text.match(/^property_(\d+)$/);
    if (propertyTapMatch) {
        // Treat as if user typed the number (property detail request)
        const idx = propertyTapMatch[1];
        return handleSmartMessage(phone, idx, user);
    }

    if (text === 'view_my_matches') {
        const { properties: matches, matchTier } = await searchByQuery({
            budget: user.budget,
            location: user.locationPreference,
            propertyType: user.propertyType,
        });

        // Save context
        user.lastSearchContext = { budget: user.budget, location: user.locationPreference, propertyType: user.propertyType, updatedAt: new Date() };
        await user.save();

        if (matches.length > 0) {
            if (matchTier === 'relaxed_budget') {
                await sendAndSave(phone, user, `🔍 I couldn't find exact matches under your budget, but here are some great options slightly higher...`);
            } else if (matchTier === 'location_only') {
                await sendAndSave(phone, user, `🔍 We don't have exactly what you asked for, but here are some properties in ${user.locationPreference}... \n\n🌐 Explore all options at https://realty.trivastu.com`);
            } else if (matchTier === 'general') {
                await sendAndSave(phone, user, `🔍 I couldn't find exact matches, but here are our newest properties... \n\n🌐 Explore everything at https://realty.trivastu.com`);
            }
            await sendPropertyInteractiveList(phone, matches);
        } else {
            await sendAndSave(phone, user, `No exact matches for ${user.locationPreference} under ${formatCurrency(user.budget)}. Want to try a different location or budget?`);
        }
        return;
    }

    if (text === 'schedule_call') {
        await notifyAdmin(ALERT_TYPES.NEW_LEAD, { name: user.name, phone: user.phone, propertyType: 'Agent call request' });
        await sendAndSave(phone, user, `👨‍💼 An agent will call you shortly on this number!`);
        return;
    }

    // 2. Detect Intent via LLM
    const history = user.getRecentHistory(6);
    const { intent, confidence, entities } = await detectIntent(text, history, {
        budget: user.budget,
        locationPreference: user.locationPreference,
        propertyType: user.propertyType,
    });

    let aiContextProperties = [];
    let responseMsg = '';

    try {
        switch (intent) {
            case INTENTS.PROPERTY_DETAIL: {
                const idx = (entities.propertyIndex || parseInt(text)) - 1;
                // Query using last search context
                const ctx = user.lastSearchContext?.location ? user.lastSearchContext : user;
                const { properties: matches } = await searchByQuery({
                    budget: ctx.budget, location: ctx.locationPreference || ctx.location, propertyType: ctx.propertyType
                });

                if (idx >= 0 && idx < matches.length) {
                    const prop = matches[idx];
                    aiContextProperties = [prop];
                    responseMsg = await generateResponse(text, history, user, aiContextProperties, 'strict');

                    // Behavioral Tracking: Track that they viewed this property
                    if (user.trackPropertyView) {
                        user.trackPropertyView(prop._id);
                        await user.save();
                    }

                    // Also send media explicitly if available so they get photos
                    if (prop.images && prop.images.length > 0) {
                        const { getSignedUrl } = require('./s3Service');
                        for (let i = 0; i < Math.min(prop.images.length, 3); i++) {
                            try {
                                const url = await getSignedUrl(prop.images[i]);
                                await whatsappService.sendMediaMessage(phone, 'image', url, `${prop.title} - Photo ${i + 1}`);
                            } catch (err) { }
                        }
                    }
                } else {
                    responseMsg = `Sorry, I couldn't find that property. Could you please specify which location or tell me what kind of property you're looking for?`;
                }
                break;
            }

            case INTENTS.LOCATION_QUERY:
            case INTENTS.PROPERTY_SEARCH:
            case INTENTS.BUDGET_UPDATE:
            case INTENTS.TYPE_UPDATE:
            case INTENTS.UPDATE_PREFS: {
                // Update user profile silently based on what was extracted
                let updated = false;
                if (entities.budget && entities.budget !== user.budget) {
                    user.budget = entities.budget;
                    if (!user.behavior) user.behavior = {};
                    user.behavior.budgetShifts = (user.behavior.budgetShifts || 0) + 1;
                    updated = true;
                }
                if (entities.location) { user.locationPreference = entities.location; updated = true; }
                if (entities.propertyType) { user.propertyType = entities.propertyType; updated = true; }

                if (updated) await user.save();

                // Search database with NEW preferences
                const { properties: ptList, matchTier } = await searchByQuery({
                    budget: entities.budget || user.budget,
                    location: entities.location || user.locationPreference,
                    propertyType: entities.propertyType || user.propertyType,
                    bedrooms: entities.bedrooms
                });
                aiContextProperties = ptList;

                // Update context
                user.lastSearchContext = {
                    budget: entities.budget || user.budget,
                    location: entities.location || user.locationPreference,
                    propertyType: entities.propertyType || user.propertyType,
                    bedrooms: entities.bedrooms,
                    updatedAt: new Date()
                };
                await user.save();

                if (updated && user.budget > 0) {
                    await notifyAdmin('CUSTOMER_PREFS_UPDATED', {
                        name: user.name, phone: user.phone, budget: user.budget,
                        location: user.locationPreference
                    });

                    // Update latest lead score dynamically
                    const latestLead = await Lead.findOne({ customerId: user._id }).sort({ createdAt: -1 });
                    if (latestLead) {
                        const { calculateLeadScore } = require('./leadScoringEngine');
                        latestLead.budget = user.budget;
                        latestLead.location = user.locationPreference;
                        latestLead.propertyType = user.propertyType;

                        const newScore = calculateLeadScore(latestLead, user);
                        latestLead.aiScore = newScore.aiScore;
                        latestLead.urgency = newScore.urgency;
                        latestLead.buyerPersona = newScore.buyerPersona;
                        await latestLead.save();
                    }
                }

                // Have AI generate friendly response wrapping the list
                responseMsg = await generateResponse(text, history, user, aiContextProperties, matchTier);
                break;
            }

            case INTENTS.SCHEDULE_VISIT: {
                if (entities.visitDate || entities.visitTime) {
                    // They provided an actual time/date - Confirmed!
                    await notifyAdmin(ALERT_TYPES.SITE_VISIT_BOOKED, {
                        name: user.name, phone: user.phone,
                        location: user.locationPreference || 'Any',
                        budget: user.budget || 0,
                        visitDate: entities.visitDate,
                        visitTime: entities.visitTime
                    });
                    responseMsg = await generateResponse(text, history, user, []);
                } else {
                    // They just mentioned visiting - prompt for time/date
                    responseMsg = await generateResponse(text + " (AI Note: Ask the user what day and time they would like to visit.)", history, user, []);
                }
                break;
            }

            case INTENTS.TALK_TO_AGENT: {
                // Attempt to route to an agent
                const { assignAgentToLead } = require('./assignmentEngine');
                const latestLead = await Lead.findOne({ customerId: user._id }).sort({ createdAt: -1 });
                let agentName = "our senior agents";

                if (latestLead) {
                    const agentId = await assignAgentToLead(latestLead);
                    if (agentId) {
                        const Agent = require('../models/Agent');
                        const assignedWorker = await Agent.findOne({ whatsappNumber: agentId });
                        if (assignedWorker) agentName = assignedWorker.name;
                    }
                }

                await notifyAdmin(ALERT_TYPES.NEW_LEAD, {
                    name: user.name, phone: user.phone,
                    propertyType: 'Callback Request'
                });
                responseMsg = `I've sent a callback request! 📞 ${agentName} will call you shortly on your number (${user.phone}).`;
                break;
            }

            case INTENTS.FINANCIAL_CALC: {
                const { financialTools } = require('./financialEngine');
                // Pass tools data manually to assist the LLM if exact entities were parsed
                let financialContext = '';
                if (entities.financialData && entities.financialData.principal) {
                    const p = entities.financialData.principal;
                    const r = entities.financialData.rate || 8.5;
                    const y = entities.financialData.years || 20;
                    const emi = financialTools.calculateEMI(p, r, y);
                    financialContext = `\n[TOOL EXECUTED: calculateEMI(principal=${p}, rate=${r}, years=${y}). Result: EMI is ₹${emi}]`;
                }

                // Fetch the context property just in case they are referring to the current search
                const ctx = user.lastSearchContext?.location ? user.lastSearchContext : user;
                const { properties: ptList, matchTier } = await searchByQuery({
                    budget: ctx.budget, location: ctx.locationPreference || ctx.location, propertyType: ctx.propertyType
                });
                aiContextProperties = ptList;

                history[history.length - 1].content += financialContext; // sneaky inject
                responseMsg = await generateResponse(text, history, user, aiContextProperties, matchTier);
                break;
            }

            case INTENTS.SMALL_TALK: {
                // Respond warmly and humanly — don't push properties
                responseMsg = await generateResponse(text, history, user, null);
                break;
            }

            case INTENTS.GREET:
            case INTENTS.MENU:
            case INTENTS.CANCEL:
                return handleReturningCustomer(phone, user);


            case INTENTS.FAQ:
            case INTENTS.OTHER:
            default:
                // Just chat using history
                responseMsg = await generateResponse(text, history, user, null);
                break;
        }

        // Send and save AI response with Premium Action Buttons
        // If the intent suggests they are looking at properties, give them next steps
        if ([INTENTS.PROPERTY_SEARCH, INTENTS.PROPERTY_DETAIL, INTENTS.BUDGET_UPDATE, INTENTS.LOCATION_QUERY].includes(intent)) {
            const premiumButtons = [
                { id: 'schedule_call', title: '📞 Request Call' },
                { id: 'schedule_visit', title: '📅 Schedule Visit' }
            ];
            await sendInteractiveAndSave(phone, user, responseMsg, premiumButtons);
        } else {
            await sendAndSave(phone, user, responseMsg);
        }

    } catch (e) {
        logger.error('Smart Message Error:', e.message);
        await sendAndSave(phone, user, `Sorry, my brain just glitched! 😅 Let me connect you with our team instead.`);
    }
};

// ── UTILS ──

const sendAndSave = async (phone, user, msg) => {
    user.addToHistory('assistant', msg);
    await user.save();
    return whatsappService.sendTextMessage(phone, msg);
};

const sendInteractiveAndSave = async (phone, user, msg, buttons) => {
    user.addToHistory('assistant', msg);
    await user.save();
    return whatsappService.sendInteractiveButtons(phone, msg, buttons);
};

// Legacy manual parser exactly as before
const parseBudgetSimple = (text) => {
    let input = text.toLowerCase().replace(/,/g, '').replace(/₹/g, '').replace(/rs\.?\s*/g, '').trim();
    const hindiWords = { 'ek': 1, 'do': 2, 'teen': 3, 'chaar': 4, 'paanch': 5, 'das': 10, 'bees': 20, 'tees': 30, 'chaalees': 40, 'pachaas': 50, 'saath': 60, 'sattar': 70, 'assi': 80, 'nabbe': 90, 'sau': 100 };
    for (const [w, n] of Object.entries(hindiWords)) if (input.includes(w)) input = input.replace(w, String(n));
    input = input.replace(/करोड़|karod|crore/gi, 'cr').replace(/लाख|lakh|lac/gi, 'l').replace(/हज़ार|hazaar|k/gi, 'k');

    let amount = 0;
    const crMatch = input.match(/([\d.]+)\s*cr/);
    const lMatch = input.match(/([\d.]+)\s*l/);
    const numMatch = input.match(/([\d.]+)/);

    if (crMatch) amount = parseFloat(crMatch[1]) * 10000000;
    else if (lMatch) amount = parseFloat(lMatch[1]) * 100000;
    else if (numMatch) {
        amount = parseFloat(numMatch[1]);
        if (amount < 100) amount *= 100000; // Assume lakhs
    }
    return amount;
};

const resolvePropertyTypeLegacy = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('apartment') || lower.includes('flat')) return 'apartment';
    if (lower.includes('villa') || lower.includes('house') || lower.includes('makan')) return 'villa';
    if (lower.includes('plot') || lower.includes('land') || lower.includes('zameen')) return 'plot';
    if (lower.includes('commercial') || lower.includes('shop') || lower.includes('dukaan')) return 'commercial';
    if (lower.includes('farm')) return 'farmhouse';
    return text; // fallback
};

module.exports = { handleNewCustomer, handleReturningCustomer, handleCustomerMessage, handleCustomerImage, handleFlowSubmission, handleLeadForm };

