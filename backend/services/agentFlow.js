const User = require('../models/User');
const Agent = require('../models/Agent');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const whatsappService = require('./whatsappService');
const { notifyAdmin, ALERT_TYPES } = require('./notificationService');
const { matchProperties, formatPropertyList } = require('./matchingEngine');
const { formatCurrency, parsePhone } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── AGENT REGISTRATION START ──
const handleAgentRegistration = async (phone) => {
    const normalizedPhone = parsePhone(phone);
    let user = await User.findOne({ phone: normalizedPhone });

    if (!user) {
        user = await User.create({
            phone: normalizedPhone,
            role: 'customer',
            conversationState: { flow: 'agent_registration', step: 'ask_name', data: {} },
        });
    } else {
        user.conversationState = { flow: 'agent_registration', step: 'ask_name', data: {} };
        await user.save();
    }

    await whatsappService.sendTextMessage(normalizedPhone,
        `👨‍💼 *Agent Registration — Trivastu Realty*\n\n` +
        `Let's get you registered! I'll need a few details.\n\n` +
        `👤 What is your *full name*?\n\nType *cancel* anytime to stop.`
    );
};

// ── AGENT REGISTRATION FLOW ──
const handleAgentRegistrationFlow = async (phone, text, user) => {
    const lower = text.toLowerCase().trim();
    if (['cancel', 'menu', 'hi', 'hello', 'start', 'hey'].includes(lower)) {
        user.conversationState = {};
        user.role = 'customer';
        await user.save();
        await whatsappService.sendTextMessage(phone, `Registration cancelled. Type *MENU* for customer options.`);
        return;
    }

    const step = user.conversationState.step;

    switch (step) {
        case 'ask_name': {
            user.conversationState.data.name = text;
            user.name = text;
            user.conversationState.step = 'ask_aadhaar';
            await user.save();
            await whatsappService.sendTextMessage(phone,
                `👤 Name: *${text}* ✅\n\n🆔 Please enter your *Aadhaar number*:\n(12-digit number)`
            );
            break;
        }
        case 'ask_aadhaar': {
            user.conversationState.data.aadhaar = text.replace(/\s/g, '');
            user.conversationState.step = 'ask_pan';
            await user.save();
            await whatsappService.sendTextMessage(phone,
                `🆔 Aadhaar: ****${text.slice(-4)} ✅\n\n📄 Enter your *PAN number*:\n(e.g., ABCDE1234F)`
            );
            break;
        }
        case 'ask_pan': {
            user.conversationState.data.pan = text.toUpperCase();
            user.conversationState.step = 'ask_experience';
            await user.save();
            await whatsappService.sendTextMessage(phone,
                `📄 PAN: ${text.toUpperCase()} ✅\n\n🏢 How many years of *real estate experience* do you have?`
            );
            break;
        }
        case 'ask_experience': {
            user.conversationState.data.experience = text;
            user.conversationState.step = 'ask_bank';
            await user.save();
            await whatsappService.sendTextMessage(phone,
                `🏢 Experience: ${text} ✅\n\n🏦 Enter your *bank account details*:\n\n(Account No, IFSC, Bank Name - on one line)`
            );
            break;
        }
        case 'ask_bank': {
            user.conversationState.data.bankDetails = text;
            user.conversationState.step = 'ask_area';
            await user.save();
            await whatsappService.sendTextMessage(phone,
                `🏦 Bank details saved ✅\n\n📍 Which *area/locations* do you operate in?\n(e.g., Bhopal, Singhmore, Indore)`
            );
            break;
        }
        case 'ask_area': {
            const data = user.conversationState.data;
            data.operatingArea = text;

            // Create agent
            user.role = 'agent';
            user.conversationState = {};
            await user.save();

            const existingAgent = await Agent.findOne({ phone: user.phone });
            if (!existingAgent) {
                await Agent.create({
                    userId: user._id,
                    phone: user.phone,
                    name: data.name,
                    aadhaar: data.aadhaar,
                    pan: data.pan,
                    experience: data.experience,
                    bankDetails: data.bankDetails,
                    operatingArea: data.operatingArea,
                    status: 'pending',
                    commissionPercent: 2,
                });
            }

            await whatsappService.sendTextMessage(phone,
                `✅ *Registration Submitted!*\n\n` +
                `📋 *Your Details:*\n` +
                `👤 ${data.name}\n` +
                `🆔 Aadhaar: ****${data.aadhaar?.slice(-4)}\n` +
                `📄 PAN: ${data.pan}\n` +
                `🏢 Experience: ${data.experience}\n` +
                `📍 Area: ${data.operatingArea}\n\n` +
                `⏳ Your application is *pending admin approval*.\nYou'll receive a notification once approved! 🙏`
            );

            // Notify admin
            await notifyAdmin(ALERT_TYPES.AGENT_APP, {
                name: data.name,
                phone: user.phone,
                experience: data.experience,
                area: data.operatingArea,
            });
            break;
        }
    }
};

// ── APPROVED AGENT HANDLER ──
const handleApprovedAgent = async (phone, text, user, agent) => {
    const lower = text.toLowerCase().trim();
    const state = user.conversationState || {};

    // Check sub-flows
    if (state.flow === 'agent_add_property') {
        return handleAgentAddPropertyFlow(phone, text, user, agent);
    }

    if (['hi', 'hello', 'menu', 'start', 'hey'].includes(lower)) {
        return showAgentMenu(phone, agent);
    }

    if (lower === 'my leads' || lower === '1') return showAgentLeads(phone, agent);
    if (lower === 'add property' || lower === '2') return startAgentAddProperty(phone, user);
    if (lower === 'my properties' || lower === '3') return showAgentProperties(phone, agent);
    if (lower === 'commission' || lower === '4') return showAgentCommission(phone, agent);
    if (lower === 'profile' || lower === '5') return showAgentProfile(phone, agent);

    // Update lead status: "update lead <id> <status>"
    if (lower.startsWith('update lead ')) {
        const parts = text.substring(12).trim().split(' ');
        if (parts.length >= 2) {
            return updateLeadStatus(phone, parts[0], parts.slice(1).join(' '));
        }
    }

    return showAgentMenu(phone, agent);
};

// ── AGENT MENU ──
const showAgentMenu = async (phone, agent) => {
    await whatsappService.sendTextMessage(phone,
        `👨‍💼 *Agent Dashboard — ${agent.name}*\n\n` +
        `Type a command:\n\n` +
        `1️⃣ *my leads* — View assigned leads\n` +
        `2️⃣ *add property* — Submit new property\n` +
        `3️⃣ *my properties* — View your properties\n` +
        `4️⃣ *commission* — Check earnings\n` +
        `5️⃣ *profile* — Your profile\n\n` +
        `📋 Quick: _update lead <leadID> <status>_`
    );
};

// ── AGENT: VIEW LEADS ──
const showAgentLeads = async (phone, agent) => {
    const leads = await Lead.find({ agentId: agent._id })
        .sort({ createdAt: -1 }).limit(10).populate('customerId');

    let msg = `🎯 *Your Leads*\n\n`;
    if (leads.length === 0) {
        msg += `No leads assigned yet. New leads will appear here.`;
    } else {
        leads.forEach((l, i) => {
            const fireEmoji = l.aiScore > 75 ? '🔥' : (l.aiScore > 50 ? '⚡' : '');
            const scoreStr = l.aiScore > 0 ? `[Score: ${l.aiScore}/100]` : '';
            const personaStr = l.buyerPersona !== 'undecided' ? ` | 👤 ${l.buyerPersona}` : '';

            const cName = l.customerId?.name && l.customerId.name !== "Unknown" ? l.customerId.name : (l.name || 'Unknown');
            const cPhone = l.customerId?.phone || l.phone || 'No phone';

            msg += `${i + 1}. *${cName}* ${l.isHighValue ? '💎' : ''} ${fireEmoji}\n` +
                `   📞 ${cPhone}\n` +
                `   💰 Budget: ${formatCurrency(l.budget)} | 📍 ${l.location || 'Any'}${personaStr}\n` +
                `   ${scoreStr} Urgency: ${l.urgency || 'low'}\n` +
                `   Status: *${l.status}* | ID: ${l._id}\n\n`;
        });
        msg += `\nTo update: _update lead <ID> contacted_`;
    }
    msg += `\n\nType *MENU* for options.`;
    await whatsappService.sendTextMessage(phone, msg);
};

// ── AGENT: ADD PROPERTY ──
const startAgentAddProperty = async (phone, user) => {
    user.conversationState = {
        flow: 'agent_add_property',
        step: 'ask_title',
        data: { images: [], videos: [] },
    };
    await user.save();
    await whatsappService.sendTextMessage(phone,
        `🏠 *Add Property*\n\n📝 Enter property *title*:\n(e.g., "2BHK Flat in Indore")\n\nType *cancel* to go back.`
    );
};

const handleAgentAddPropertyFlow = async (phone, text, user, agent) => {
    const lower = text.toLowerCase().trim();
    if (['cancel', 'menu', 'hi', 'hello', 'start', 'hey'].includes(lower)) {
        user.conversationState = {};
        await user.save();
        return showAgentMenu(phone, agent);
    }

    const step = user.conversationState.step;

    switch (step) {
        case 'ask_title':
            user.conversationState.data.title = text;
            user.conversationState.step = 'ask_type';
            await user.save();
            await whatsappService.sendInteractiveButtons(phone,
                `📝 Title: *${text}* ✅\n\n🏠 Property *type*:`,
                [
                    { id: 'agent_prop_apartment', title: '🏢 Apartment' },
                    { id: 'agent_prop_villa', title: '🏡 Villa' },
                    { id: 'agent_prop_plot', title: '🌳 Plot/Land' },
                ]
            );
            break;

        case 'ask_type': {
            let ptype = text.toLowerCase();
            if (ptype.includes('apartment')) ptype = 'apartment';
            else if (ptype.includes('villa')) ptype = 'villa';
            else if (ptype.includes('plot') || ptype.includes('land')) ptype = 'plot';
            else if (ptype.includes('commercial')) ptype = 'commercial';

            user.conversationState.data.type = ptype;
            user.conversationState.step = 'ask_price';
            await user.save();
            await whatsappService.sendTextMessage(phone, `🏠 Type: *${ptype}* ✅\n\n💰 Enter *price* (e.g., 50L, 1.2Cr):`);
            break;
        }

        case 'ask_price': {
            const lower = text.toLowerCase().replace(/,/g, '').replace(/₹/g, '').trim();
            let price = 0;
            const crMatch = lower.match(/([\d.]+)\s*cr/);
            const lMatch = lower.match(/([\d.]+)\s*l/);
            const numMatch = lower.match(/([\d.]+)/);
            if (crMatch) price = parseFloat(crMatch[1]) * 10000000;
            else if (lMatch) price = parseFloat(lMatch[1]) * 100000;
            else if (numMatch) price = parseFloat(numMatch[1]);

            user.conversationState.data.price = price;
            user.conversationState.step = 'ask_location';
            await user.save();
            await whatsappService.sendTextMessage(phone, `💰 Price: *${formatCurrency(price)}* ✅\n\n📍 Enter *location*:`);
            break;
        }

        case 'ask_location':
            user.conversationState.data.location = text;
            user.conversationState.step = 'ask_area';
            await user.save();
            await whatsappService.sendTextMessage(phone, `📍 Location: *${text}* ✅\n\n📐 Enter *property area* (e.g., 1200 sqft):`);
            break;

        case 'ask_area':
            user.conversationState.data.area = parseFloat(text) || 0;
            user.conversationState.step = 'ask_description';
            await user.save();
            await whatsappService.sendTextMessage(phone, `📐 Area: *${text}* ✅\n\n📝 Enter *description*:`);
            break;

        case 'ask_description':
            user.conversationState.data.description = text;
            user.conversationState.step = 'ask_media';
            await user.save();
            await whatsappService.sendTextMessage(phone,
                `📝 Description saved ✅\n\n📸 Send *images/videos*, or type *done* to finish.`
            );
            break;

        case 'ask_media': {
            if (text.toLowerCase() === 'done' || text.toLowerCase() === 'skip') {
                const d = user.conversationState.data;
                const property = await Property.create({
                    title: d.title,
                    type: d.type,
                    price: d.price,
                    location: d.location,
                    area: d.area || 0,
                    description: d.description,
                    images: d.images || [],
                    videos: d.videos || [],
                    status: 'pending',
                    addedBy: user._id,
                });

                user.conversationState = {};
                await user.save();

                await whatsappService.sendTextMessage(phone,
                    `✅ *Property Submitted!*\n\n` +
                    `🏠 ${d.title}\n📍 ${d.location} | 💰 ${formatCurrency(d.price)}\n` +
                    `📸 ${(d.images || []).length} photos | 🎬 ${(d.videos || []).length} videos\n\n` +
                    `⏳ Pending admin approval.\n\nType *MENU* for options.`
                );

                await notifyAdmin(ALERT_TYPES.PROPERTY_UPLOAD, {
                    agent: agent.name,
                    title: d.title,
                    location: d.location,
                    price: d.price,
                });
            } else {
                await whatsappService.sendTextMessage(phone, `📸 Send photos/videos, or type *done*.`);
            }
            break;
        }
    }
};

// ── AGENT: VIEW PROPERTIES ──
const showAgentProperties = async (phone, agent) => {
    const properties = await Property.find({ addedBy: agent.userId }).sort({ createdAt: -1 });
    let msg = `🏠 *Your Properties*\n\n`;
    if (properties.length === 0) {
        msg += `No properties added yet. Type *add property* to start.`;
    } else {
        properties.forEach((p, i) => {
            const statusEmoji = { approved: '✅', pending: '⏳', rejected: '❌' };
            msg += `${i + 1}. *${p.title}* ${statusEmoji[p.status] || ''}\n` +
                `   📍 ${p.location} | 💰 ${formatCurrency(p.price)}\n` +
                `   📸 ${p.images?.length || 0} photos\n\n`;
        });
    }
    msg += `\nType *MENU* for options.`;
    await whatsappService.sendTextMessage(phone, msg);
};

// ── AGENT: COMMISSION ──
const showAgentCommission = async (phone, agent) => {
    const Commission = require('../models/Commission');
    const commissions = await Commission.find({ agentId: agent._id }).sort({ createdAt: -1 }).limit(10);
    const total = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);

    let msg = `💰 *Commission Report*\n\n` +
        `📊 Total Earned: *${formatCurrency(total)}*\n` +
        `🤝 Total Deals: *${agent.totalDeals || 0}*\n` +
        `📈 Commission Rate: *${agent.commissionPercent}%*\n\n`;

    if (commissions.length > 0) {
        msg += `Recent transactions:\n`;
        commissions.forEach((c, i) => {
            msg += `${i + 1}. ${formatCurrency(c.amount)} — ${c.status}\n`;
        });
    }
    msg += `\nType *MENU* for options.`;
    await whatsappService.sendTextMessage(phone, msg);
};

// ── AGENT: PROFILE ──
const showAgentProfile = async (phone, agent) => {
    await whatsappService.sendTextMessage(phone,
        `👨‍💼 *Agent Profile*\n\n` +
        `👤 Name: ${agent.name}\n` +
        `📱 Phone: ${agent.phone}\n` +
        `🏢 Experience: ${agent.experience || 'N/A'}\n` +
        `📍 Area: ${agent.operatingArea || 'N/A'}\n` +
        `💰 Commission: ${agent.commissionPercent}%\n` +
        `🤝 Deals: ${agent.totalDeals || 0}\n` +
        `✅ Status: ${agent.status}\n\n` +
        `Type *MENU* for options.`
    );
};

// ── UPDATE LEAD STATUS ──
const updateLeadStatus = async (phone, leadId, status) => {
    try {
        const lead = await Lead.findById(leadId);
        if (!lead) {
            return whatsappService.sendTextMessage(phone, `❌ Lead not found.`);
        }

        const cleanStatus = status.toLowerCase().replace(/ /g, '_');
        lead.status = cleanStatus;

        // Automated Visit Tracking
        if (['visited', 'site_visit_done', 'visit_done'].includes(cleanStatus)) {
            // Need to update Agent stats if it wasn't already marked visited
            if (!lead.siteVisitDate) {
                lead.siteVisitDate = new Date();

                if (lead.agentId) {
                    const agent = await Agent.findById(lead.agentId);
                    if (agent) {
                        agent.totalVisits = (agent.totalVisits || 0) + 1;
                        await agent.save();
                    }
                }
            }
        }

        await lead.save();
        await whatsappService.sendTextMessage(phone, `✅ Lead updated to *${status}*`);
    } catch (e) {
        await whatsappService.sendTextMessage(phone, `❌ Invalid lead ID.`);
    }
};

// ── HANDLE MEDIA FROM AGENT ──
const handleAgentMedia = async (phone, mediaKey, mediaType, user, agent) => {
    if (user.conversationState?.flow === 'agent_add_property' && user.conversationState?.step === 'ask_media') {
        if (mediaType === 'image') {
            user.conversationState.data.images = user.conversationState.data.images || [];
            user.conversationState.data.images.push(mediaKey);
        } else if (mediaType === 'video') {
            user.conversationState.data.videos = user.conversationState.data.videos || [];
            user.conversationState.data.videos.push(mediaKey);
        }
        await user.save();

        const imgCount = (user.conversationState.data.images || []).length;
        const vidCount = (user.conversationState.data.videos || []).length;
        await whatsappService.sendTextMessage(phone,
            `✅ ${mediaType === 'image' ? '📸 Photo' : '🎬 Video'} uploaded! (${imgCount} photos, ${vidCount} videos)\n\nSend more or type *done*.`
        );
        return true;
    }
    return false;
};

module.exports = {
    handleAgentRegistration,
    handleAgentRegistrationFlow,
    handleApprovedAgent,
    handleAgentMedia,
};
