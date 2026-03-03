const User = require('../models/User');
const Agent = require('../models/Agent');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const whatsappService = require('./whatsappService');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── ADMIN MAIN MESSAGE HANDLER ──
const handleAdminMessage = async (phone, text, user) => {
    const lower = text.toLowerCase().trim();
    const state = user.conversationState || {};

    // Check if admin is in a sub-flow
    if (state.flow === 'admin_add_agent') {
        return handleAdminAddAgentFlow(phone, text, user);
    }
    if (state.flow === 'admin_add_property') {
        return handleAdminAddPropertyFlow(phone, text, user);
    }

    // ── Commands ──
    if (['hi', 'hello', 'menu', 'start', 'hey'].includes(lower)) {
        return showAdminMenu(phone);
    }

    if (lower === 'stats' || lower === 'dashboard' || lower === '1') {
        return showStats(phone);
    }

    if (lower === 'pending' || lower === '2') {
        return showPending(phone);
    }

    if (lower === 'leads' || lower === '3') {
        return showRecentLeads(phone);
    }

    if (lower === 'agents' || lower === '4') {
        return showAgentsList(phone);
    }

    if (lower === 'add agent' || lower === '5') {
        return startAddAgent(phone, user);
    }

    if (lower === 'properties' || lower === '6') {
        return showProperties(phone);
    }

    if (lower === 'add property' || lower === '7') {
        return startAddProperty(phone, user);
    }

    // Approve/Reject agent: "approve +91..." or "reject +91..."
    if (lower.startsWith('approve ')) {
        return approveAgent(phone, text.substring(8).trim());
    }
    if (lower.startsWith('reject ')) {
        return rejectAgent(phone, text.substring(7).trim());
    }

    // Approve/Reject property: "approve property <id>"
    if (lower.startsWith('approve property ')) {
        return approveProperty(phone, text.substring(17).trim());
    }

    // Default: show menu
    return showAdminMenu(phone);
};

// ── ADMIN MENU ──
const showAdminMenu = async (phone) => {
    await whatsappService.sendTextMessage(phone,
        `👑 *ADMIN PANEL — Trivastu Realty*\n\n` +
        `Type a number or command:\n\n` +
        `1️⃣ *stats* — Dashboard overview\n` +
        `2️⃣ *pending* — Pending approvals\n` +
        `3️⃣ *leads* — Recent leads\n` +
        `4️⃣ *agents* — View all agents\n` +
        `5️⃣ *add agent* — Register new agent\n` +
        `6️⃣ *properties* — View properties\n` +
        `7️⃣ *add property* — Add new property\n\n` +
        `📋 Quick commands:\n` +
        `• _approve +91XXXXXXXXXX_ — Approve agent\n` +
        `• _reject +91XXXXXXXXXX_ — Reject agent\n` +
        `• _approve property <ID>_ — Approve property`
    );
};

// ── STATS ──
const showStats = async (phone) => {
    const [totalLeads, newLeads, totalAgents, activeAgents, pendingAgents,
        totalProperties, approvedProperties, pendingProperties] = await Promise.all([
            Lead.countDocuments(),
            Lead.countDocuments({ status: 'new' }),
            Agent.countDocuments(),
            Agent.countDocuments({ status: 'approved' }),
            Agent.countDocuments({ status: 'pending' }),
            Property.countDocuments(),
            Property.countDocuments({ status: 'approved' }),
            Property.countDocuments({ status: 'pending' }),
        ]);

    const highValueLeads = await Lead.countDocuments({ isHighValue: true });

    await whatsappService.sendTextMessage(phone,
        `📊 *DASHBOARD STATS*\n\n` +
        `🎯 *Leads:*\n` +
        `• Total: ${totalLeads}\n` +
        `• New: ${newLeads}\n` +
        `• High-value (>50L): ${highValueLeads}\n\n` +
        `👥 *Agents:*\n` +
        `• Total: ${totalAgents}\n` +
        `• Active: ${activeAgents}\n` +
        `• Pending: ${pendingAgents}\n\n` +
        `🏠 *Properties:*\n` +
        `• Total: ${totalProperties}\n` +
        `• Approved: ${approvedProperties}\n` +
        `• Pending: ${pendingProperties}\n\n` +
        `Type *MENU* for options.`
    );
};

// ── PENDING APPROVALS ──
const showPending = async (phone) => {
    const pendingAgents = await Agent.find({ status: 'pending' }).populate('userId');
    const pendingProperties = await Property.find({ status: 'pending' });

    let msg = `⏳ *PENDING APPROVALS*\n\n`;

    if (pendingAgents.length > 0) {
        msg += `👥 *Agents (${pendingAgents.length}):*\n`;
        pendingAgents.forEach((a, i) => {
            msg += `${i + 1}. ${a.name} — ${a.phone}\n   Exp: ${a.experience || 'N/A'}\n   _approve ${a.phone}_\n\n`;
        });
    } else {
        msg += `👥 No pending agents ✅\n\n`;
    }

    if (pendingProperties.length > 0) {
        msg += `🏠 *Properties (${pendingProperties.length}):*\n`;
        pendingProperties.forEach((p, i) => {
            msg += `${i + 1}. ${p.title} — ${formatCurrency(p.price)}\n   📍 ${p.location}\n   ID: _${p._id}_\n   _approve property ${p._id}_\n\n`;
        });
    } else {
        msg += `🏠 No pending properties ✅\n`;
    }

    msg += `\nType *MENU* for options.`;
    await whatsappService.sendTextMessage(phone, msg);
};

// ── RECENT LEADS ──
const showRecentLeads = async (phone) => {
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(10).populate('customerId');

    let msg = `🎯 *RECENT LEADS (top 10)*\n\n`;

    if (leads.length === 0) {
        msg += `No leads yet.\n`;
    } else {
        leads.forEach((l, i) => {
            const name = l.customerId?.name || 'Unknown';
            msg += `${i + 1}. *${name}* ${l.isHighValue ? '💎' : ''}\n` +
                `   💰 ${formatCurrency(l.budget)} | 📍 ${l.location}\n` +
                `   🏠 ${l.propertyType} | Status: ${l.status}\n\n`;
        });
    }

    msg += `Type *MENU* for options.`;
    await whatsappService.sendTextMessage(phone, msg);
};

// ── LIST AGENTS ──
const showAgentsList = async (phone) => {
    const agents = await Agent.find().sort({ createdAt: -1 });

    let msg = `👥 *ALL AGENTS*\n\n`;

    if (agents.length === 0) {
        msg += `No agents registered yet.\n`;
    } else {
        agents.forEach((a, i) => {
            const statusEmoji = { approved: '✅', pending: '⏳', suspended: '🚫', rejected: '❌' };
            msg += `${i + 1}. *${a.name}* ${statusEmoji[a.status] || ''}\n` +
                `   📱 ${a.phone} | Deals: ${a.totalDeals || 0}\n` +
                `   Commission: ${a.commissionPercent}%\n\n`;
        });
    }

    msg += `Type *add agent* to register a new agent.\nType *MENU* for options.`;
    await whatsappService.sendTextMessage(phone, msg);
};

// ── ADD AGENT FLOW ──
const startAddAgent = async (phone, user) => {
    user.conversationState = {
        flow: 'admin_add_agent',
        step: 'ask_phone',
        data: {},
    };
    await user.save();

    await whatsappService.sendTextMessage(phone,
        `👥 *Add New Agent*\n\n📱 Enter the agent's WhatsApp number:\n\n(e.g., +918105180539)\n\nType *cancel* to go back.`
    );
};

const handleAdminAddAgentFlow = async (phone, text, user) => {
    if (text.toLowerCase() === 'cancel') {
        user.conversationState = {};
        await user.save();
        return showAdminMenu(phone);
    }

    const step = user.conversationState.step;

    switch (step) {
        case 'ask_phone': {
            let agentPhone = text.replace(/\s/g, '');
            if (!agentPhone.startsWith('+')) {
                if (agentPhone.startsWith('91') && agentPhone.length === 12) agentPhone = '+' + agentPhone;
                else if (agentPhone.length === 10) agentPhone = '+91' + agentPhone;
            }
            user.conversationState.data.phone = agentPhone;
            user.conversationState.step = 'ask_name';
            await user.save();
            await whatsappService.sendTextMessage(phone, `📱 Phone: *${agentPhone}* ✅\n\n👤 Enter agent's *full name*:`);
            break;
        }
        case 'ask_name': {
            user.conversationState.data.name = text;
            user.conversationState.step = 'ask_commission';
            await user.save();
            await whatsappService.sendTextMessage(phone, `👤 Name: *${text}* ✅\n\n💰 Enter *commission percentage* (default: 2):`);
            break;
        }
        case 'ask_commission': {
            const commission = parseFloat(text) || 2;
            const data = user.conversationState.data;

            // Create user + agent
            let agentUser = await User.findOne({ phone: data.phone });
            if (!agentUser) {
                agentUser = await User.create({
                    phone: data.phone,
                    name: data.name,
                    role: 'agent',
                });
            } else {
                agentUser.role = 'agent';
                agentUser.name = data.name;
                await agentUser.save();
            }

            const existingAgent = await Agent.findOne({ phone: data.phone });
            if (existingAgent) {
                existingAgent.status = 'approved';
                existingAgent.name = data.name;
                existingAgent.commissionPercent = commission;
                await existingAgent.save();
            } else {
                await Agent.create({
                    userId: agentUser._id,
                    phone: data.phone,
                    name: data.name,
                    status: 'approved',
                    commissionPercent: commission,
                });
            }

            user.conversationState = {};
            await user.save();

            await whatsappService.sendTextMessage(phone,
                `✅ *Agent Added Successfully!*\n\n` +
                `👤 ${data.name}\n📱 ${data.phone}\n💰 Commission: ${commission}%\n` +
                `Status: Approved ✅\n\nType *MENU* for options.`
            );

            // Notify the agent
            try {
                await whatsappService.sendTextMessage(data.phone,
                    `🎉 *Congratulations!*\n\nYou've been registered as an agent with *Trivastu Realty*.\n\n` +
                    `Type *MENU* to see your agent dashboard.`
                );
            } catch (e) { logger.debug('Could not notify new agent:', e.message); }
            break;
        }
    }
};

// ── LIST PROPERTIES ──
const showProperties = async (phone) => {
    const properties = await Property.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(10);

    let msg = `🏠 *PROPERTIES (Approved)*\n\n`;
    if (properties.length === 0) {
        msg += `No approved properties yet.\n`;
    } else {
        properties.forEach((p, i) => {
            msg += `${i + 1}. *${p.title}*\n` +
                `   📍 ${p.location} | 💰 ${formatCurrency(p.price)}\n` +
                `   🏗 ${p.type} | 📐 ${p.area || 'N/A'}\n` +
                `   📸 ${p.images?.length || 0} photos | 🎬 ${p.videos?.length || 0} videos\n\n`;
        });
    }

    msg += `Type *add property* to add new.\nType *MENU* for options.`;
    await whatsappService.sendTextMessage(phone, msg);
};

// ── ADD PROPERTY FLOW ──
const startAddProperty = async (phone, user) => {
    user.conversationState = {
        flow: 'admin_add_property',
        step: 'ask_title',
        data: { images: [], videos: [] },
    };
    await user.save();

    await whatsappService.sendTextMessage(phone,
        `🏠 *Add New Property*\n\n📝 Enter property *title*:\n\n(e.g., "3BHK Luxury Villa in Bhopal")\n\nType *cancel* to go back.`
    );
};

const handleAdminAddPropertyFlow = async (phone, text, user) => {
    if (text.toLowerCase() === 'cancel') {
        user.conversationState = {};
        await user.save();
        return showAdminMenu(phone);
    }

    const step = user.conversationState.step;

    switch (step) {
        case 'ask_title':
            user.conversationState.data.title = text;
            user.conversationState.step = 'ask_type';
            await user.save();
            await whatsappService.sendInteractiveButtons(phone,
                `📝 Title: *${text}* ✅\n\n🏠 Select property *type*:`,
                [
                    { id: 'prop_apartment', title: '🏢 Apartment' },
                    { id: 'prop_villa', title: '🏡 Villa' },
                    { id: 'prop_plot', title: '🌳 Plot/Land' },
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
            await whatsappService.sendTextMessage(phone, `📍 Location: *${text}* ✅\n\n📐 Enter *area* (e.g., 1200 sqft, 2400 sqft):`);
            break;

        case 'ask_area':
            user.conversationState.data.area = text;
            user.conversationState.step = 'ask_description';
            await user.save();
            await whatsappService.sendTextMessage(phone, `📐 Area: *${text}* ✅\n\n📝 Enter a *description*:\n\n(Short paragraph about the property)`);
            break;

        case 'ask_description': {
            user.conversationState.data.description = text;
            user.conversationState.step = 'ask_media';
            await user.save();
            await whatsappService.sendTextMessage(phone,
                `📝 Description saved ✅\n\n` +
                `📸 Now send *images/videos* of the property.\n\n` +
                `• Send photos one by one\n` +
                `• Send videos for virtual tour\n` +
                `• Type *done* when finished`
            );
            break;
        }

        case 'ask_media': {
            if (text.toLowerCase() === 'done' || text.toLowerCase() === 'skip') {
                // Save property
                const d = user.conversationState.data;
                const property = await Property.create({
                    title: d.title,
                    type: d.type,
                    price: d.price,
                    location: d.location,
                    area: d.area,
                    description: d.description,
                    images: d.images || [],
                    videos: d.videos || [],
                    status: 'approved', // Admin adds = auto-approved
                    addedBy: user._id,
                });

                user.conversationState = {};
                await user.save();

                await whatsappService.sendTextMessage(phone,
                    `✅ *Property Added Successfully!*\n\n` +
                    `🏠 ${d.title}\n` +
                    `📍 ${d.location} | 💰 ${formatCurrency(d.price)}\n` +
                    `🏗 ${d.type} | 📐 ${d.area}\n` +
                    `📸 ${(d.images || []).length} photos | 🎬 ${(d.videos || []).length} videos\n` +
                    `Status: Approved ✅\n\nType *MENU* for options.`
                );
            } else {
                await whatsappService.sendTextMessage(phone,
                    `📸 Send images/videos, or type *done* when finished.`
                );
            }
            break;
        }
    }
};

// ── APPROVE/REJECT AGENT ──
const approveAgent = async (phone, agentPhone) => {
    let cleanedPhone = agentPhone.replace(/\s/g, '');
    if (!cleanedPhone.startsWith('+')) {
        if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) cleanedPhone = '+' + cleanedPhone;
        else if (cleanedPhone.length === 10) cleanedPhone = '+91' + cleanedPhone;
    }

    const agent = await Agent.findOne({ phone: cleanedPhone });
    if (!agent) {
        return whatsappService.sendTextMessage(phone, `❌ Agent not found: ${cleanedPhone}`);
    }

    agent.status = 'approved';
    await agent.save();

    await whatsappService.sendTextMessage(phone, `✅ Agent *${agent.name}* (${cleanedPhone}) approved!`);

    try {
        await whatsappService.sendTextMessage(cleanedPhone,
            `🎉 *Congratulations ${agent.name}!*\n\nYour agent registration has been *approved*.\n\nType *MENU* to access your agent dashboard.`
        );
    } catch (e) { logger.debug('Could not notify agent:', e.message); }
};

const rejectAgent = async (phone, agentPhone) => {
    let cleanedPhone = agentPhone.replace(/\s/g, '');
    if (!cleanedPhone.startsWith('+')) {
        if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) cleanedPhone = '+' + cleanedPhone;
        else if (cleanedPhone.length === 10) cleanedPhone = '+91' + cleanedPhone;
    }

    const agent = await Agent.findOne({ phone: cleanedPhone });
    if (!agent) {
        return whatsappService.sendTextMessage(phone, `❌ Agent not found: ${cleanedPhone}`);
    }

    agent.status = 'rejected';
    await agent.save();

    await whatsappService.sendTextMessage(phone, `❌ Agent *${agent.name}* (${cleanedPhone}) rejected.`);
};

// ── APPROVE PROPERTY ──
const approveProperty = async (phone, propertyId) => {
    try {
        const property = await Property.findById(propertyId.trim());
        if (!property) {
            return whatsappService.sendTextMessage(phone, `❌ Property not found: ${propertyId}`);
        }

        property.status = 'approved';
        await property.save();

        await whatsappService.sendTextMessage(phone,
            `✅ Property *${property.title}* approved!\n📍 ${property.location} | 💰 ${formatCurrency(property.price)}`
        );
    } catch (e) {
        await whatsappService.sendTextMessage(phone, `❌ Invalid property ID: ${propertyId}`);
    }
};

// ── HANDLE MEDIA FROM ADMIN (for property uploads) ──
const handleAdminMedia = async (phone, mediaKey, mediaType, user) => {
    if (user.conversationState?.flow === 'admin_add_property' && user.conversationState?.step === 'ask_media') {
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
            `✅ ${mediaType === 'image' ? '📸 Photo' : '🎬 Video'} uploaded! (${imgCount} photos, ${vidCount} videos)\n\n` +
            `Send more or type *done* to finish.`
        );
        return true;
    }
    return false;
};

module.exports = { handleAdminMessage, handleAdminMedia };
