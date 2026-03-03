const User = require('../models/User');
const Agent = require('../models/Agent');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const whatsappService = require('./whatsappService');
const { formatCurrency } = require('../utils/helpers');
const { parseAdminCommand } = require('./llmService');
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

    // Parse natural language command with LLM
    const command = await parseAdminCommand(text);

    switch (command.action) {
        case 'stats': return showStats(phone);
        case 'pending': return showPending(phone);
        case 'leads': return showRecentLeads(phone);
        case 'agents': return showAgentsList(phone);
        case 'properties': return showProperties(phone);
        case 'add_agent': return startAddAgent(phone, user);
        case 'add_property': return startAddProperty(phone, user);

        case 'approve_agent':
            if (command.phone) return approveAgent(phone, command.phone);
            break;
        case 'reject_agent':
            if (command.phone) return rejectAgent(phone, command.phone);
            break;
        case 'approve_property':
            if (command.id) return approveProperty(phone, command.id);
            break;

        case 'update_lead':
            if (command.id && command.value) return updateLeadStatus(phone, command.id, command.value);
            break;
        case 'update_property':
            if (command.id && command.field && command.value) return updatePropertyField(phone, command.id, command.field, command.value);
            break;

        case 'search_customer':
            if (command.phone) return searchCustomerProfile(phone, command.phone);
            break;

        case 'menu': return showAdminMenu(phone);
    }

    // Fallbacks (legacy manual triggers)
    if (['hi', 'hello', 'menu', 'start', 'hey'].includes(lower)) return showAdminMenu(phone);
    if (lower === '1') return showStats(phone);
    if (lower === '2') return showPending(phone);
    if (lower === '3') return showRecentLeads(phone);
    if (lower === '4') return showAgentsList(phone);
    if (lower === '5') return startAddAgent(phone, user);
    if (lower === '6') return showProperties(phone);
    if (lower === '7') return startAddProperty(phone, user);

    // Explicit old commands
    if (lower.startsWith('approve +91')) return approveAgent(phone, text.substring(8).trim());
    if (lower.startsWith('reject +91')) return rejectAgent(phone, text.substring(7).trim());
    if (lower.startsWith('approve property ')) return approveProperty(phone, text.substring(17).trim());
    if (lower.startsWith('update property ')) {
        const parts = text.split(' ');
        if (parts.length >= 4) return updatePropertyField(phone, parts[2], parts[3], parts.slice(4).join(' '));
    }
    if (lower.startsWith('update lead ')) {
        const parts = text.split(' ');
        if (parts.length >= 4) return updateLeadStatus(phone, parts[2], parts.slice(3).join(' '));
    }

    // Default: show menu
    return showAdminMenu(phone);
};

// ── ADMIN MENU ──
const showAdminMenu = async (phone) => {
    await whatsappService.sendTextMessage(phone,
        `👑 *ADMIN PANEL — Trivastu Realty*\n\n` +
        `Type a number or ask naturally:\n\n` +
        `1️⃣ *stats* — Dashboard overview\n` +
        `2️⃣ *pending* — Pending approvals\n` +
        `3️⃣ *leads* — Recent leads\n` +
        `4️⃣ *agents* — View all agents\n` +
        `5️⃣ *add agent* — Register new agent\n` +
        `6️⃣ *properties* — View properties\n` +
        `7️⃣ *add property* — Add new property\n\n` +
        `📋 *Advanced Commands:*\n` +
        `• _update property <ID> price 45L_\n` +
        `• _update lead <ID> contacted_\n` +
        `• _search customer <phone>_`
    );
};

// ... (stats, pending, leads, agents blocks remain mostly unchanged) ...
// ── STATS (ENTERPRISE DASHBOARD) ──
const showStats = async (phone) => {
    const { getDashboardStats } = require('./analyticsService');
    const stats = await getDashboardStats();

    let msg = `📊 *ENTERPRISE DASHBOARD*\n\n`;

    msg += `🎯 *Pipeline Overview*\n`;
    msg += `• Total Leads: ${stats.pipeline.total}\n`;
    msg += `• Active: ${stats.pipeline.active}\n`;
    msg += `• Closed Won: ${stats.pipeline.closedWon} (${stats.pipeline.conversionRate})\n\n`;

    msg += `🧠 *AI Intelligence*\n`;
    msg += `• 🔥 Hot Leads (>75 Score): ${stats.aiIntelligence.hotLeads}\n`;
    msg += `• ⚡ Immediate Urgency: ${stats.aiIntelligence.immediateUrgency}\n`;
    msg += `• 👤 Persona (Investors): ${stats.aiIntelligence.personas['investor'] || 0}\n\n`;

    msg += `🏠 *Inventory Insights*\n`;
    msg += `• Active Properties: ${stats.inventory.totalActive}\n`;
    msg += `• Aging (>30 days): ${stats.inventory.agingOver30Days}\n\n`;

    if (stats.inventory.demandHeatmap.length > 0) {
        msg += `🗺️ *Top Demand Locations*\n`;
        stats.inventory.demandHeatmap.forEach((loc, i) => {
            msg += `  ${i + 1}. ${loc.location} (${loc.requests} reqs)\n`;
        });
        msg += `\n`;
    }

    if (stats.topAgents.length > 0) {
        msg += `🏆 *Top Agents*\n`;
        stats.topAgents.slice(0, 3).forEach((a, i) => {
            msg += `  ${i + 1}. ${a.name} (⭐ ${a.aiRating.toFixed(1)} | 🤝 ${a.totalDeals})\n`;
        });
    }

    await whatsappService.sendTextMessage(phone, msg);
};

const showPending = async (phone) => {
    const pendingAgents = await Agent.find({ status: 'pending' }).populate('userId');
    const pendingProperties = await Property.find({ status: 'pending' });
    let msg = `⏳ *PENDING APPROVALS*\n\n`;
    msg += `👥 *Agents (${pendingAgents.length}):*\n`;
    pendingAgents.forEach((a, i) => msg += `${i + 1}. ${a.name} — ${a.phone}\n   _approve ${a.phone}_\n\n`);
    msg += `🏠 *Properties (${pendingProperties.length}):*\n`;
    pendingProperties.forEach((p, i) => msg += `${i + 1}. ${p.title} (${p._id})\n   _approve property ${p._id}_\n\n`);
    await whatsappService.sendTextMessage(phone, msg);
};

const showRecentLeads = async (phone) => {
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(10).populate('customerId');
    let msg = `🎯 *RECENT LEADS (top 10)*\n\n`;
    leads.forEach((l, i) => msg += `${i + 1}. *${l.customerId?.name || 'Unknown'}* | ${l.status}\n   💰 ${formatCurrency(l.budget)} | 📍 ${l.location}\n   ID: ${l._id}\n\n`);
    await whatsappService.sendTextMessage(phone, msg);
};

const showAgentsList = async (phone) => {
    const agents = await Agent.find().sort({ createdAt: -1 });
    let msg = `👥 *ALL AGENTS*\n\n`;
    agents.forEach((a, i) => msg += `${i + 1}. *${a.name}* (${a.status})\n   📱 ${a.phone} | Comm: ${a.commissionPercent}%\n\n`);
    await whatsappService.sendTextMessage(phone, msg);
};

// ── ADD AGENT FLOW (FIXED) ──
const startAddAgent = async (phone, user) => {
    user.conversationState = { flow: 'admin_add_agent', step: 'ask_phone', data: {} };
    await user.save();
    await whatsappService.sendTextMessage(phone, `👥 *Add New Agent*\n\n📱 Enter the agent's WhatsApp number:\n\n(e.g., +918105180539)\n\nType *cancel* to go back.`);
};

const handleAdminAddAgentFlow = async (phone, text, user) => {
    if (text.toLowerCase() === 'cancel') {
        user.conversationState = {}; await user.save();
        return showAdminMenu(phone);
    }

    const d = user.conversationState.data;

    switch (user.conversationState.step) {
        case 'ask_phone': {
            let p = text.replace(/\s/g, '');
            if (!p.startsWith('+')) p = p.length === 10 ? '+91' + p : (p.length === 12 ? '+' + p : p);
            d.phone = p; user.conversationState.step = 'ask_name'; await user.save();
            await whatsappService.sendTextMessage(phone, `📱 Phone: *${p}* ✅\n\n👤 Enter agent's *full name*:`);
            break;
        }
        case 'ask_name': {
            d.name = text; user.conversationState.step = 'ask_experience'; await user.save();
            await whatsappService.sendTextMessage(phone, `👤 Name: *${text}* ✅\n\n🏢 Enter *experience* (e.g., 5 years):`);
            break;
        }
        case 'ask_experience': {
            d.experience = text; user.conversationState.step = 'ask_area'; await user.save();
            await whatsappService.sendTextMessage(phone, `🏢 Experience: *${text}* ✅\n\n📍 Enter *primary area* (e.g., Ranchi):`);
            break;
        }
        case 'ask_area': {
            d.area = text; user.conversationState.step = 'ask_commission'; await user.save();
            await whatsappService.sendTextMessage(phone, `📍 Area: *${text}* ✅\n\n💰 Enter *commission percentage* (default: 2):`);
            break;
        }
        case 'ask_commission': {
            const comm = parseFloat(text) || 2;
            let agentUser = await User.findOne({ phone: d.phone });
            if (!agentUser) agentUser = await User.create({ phone: d.phone, name: d.name, role: 'agent' });
            else { agentUser.role = 'agent'; agentUser.name = d.name; await agentUser.save(); }

            let existingAgent = await Agent.findOne({ phone: d.phone });
            if (existingAgent) {
                existingAgent.status = 'approved'; existingAgent.name = d.name;
                existingAgent.experience = d.experience; existingAgent.operatingArea = d.area;
                existingAgent.commissionPercent = comm; await existingAgent.save();
            } else {
                await Agent.create({
                    userId: agentUser._id, phone: d.phone, name: d.name, status: 'approved',
                    experience: d.experience, operatingArea: d.area, commissionPercent: comm,
                });
            }

            user.conversationState = {}; await user.save();
            await whatsappService.sendTextMessage(phone, `✅ *Agent Added Successfully!*\n👤 ${d.name}\n📱 ${d.phone}\n📍 ${d.area}\n💰 Commission: ${comm}%`);
            try { await whatsappService.sendTextMessage(d.phone, `🎉 *Congratulations!*\nYou've been registered as an agent with *Trivastu Realty*.\nType *MENU* to see your dashboard.`); } catch (e) { }
            break;
        }
    }
};

// ── ADMIN NEW COMMANDS ──

const searchCustomerProfile = async (phone, customerPhone) => {
    let cp = customerPhone.replace(/\s/g, '');
    if (!cp.startsWith('+')) cp = cp.length === 10 ? '+91' + cp : '+' + cp;

    const customer = await User.findOne({ phone: cp });
    if (!customer) return whatsappService.sendTextMessage(phone, `❌ Customer not found: ${cp}`);

    const leads = await Lead.find({ customerId: customer._id });
    let msg = `👤 *CUSTOMER PROFILE*\n\nName: ${customer.name}\nPhone: ${customer.phone}\nBudget: ${formatCurrency(customer.budget)}\nLocation: ${customer.locationPreference}\n\n*Leads:*\n`;
    leads.forEach(l => msg += `ID: ${l._id} | Status: ${l.status}\n`);

    await whatsappService.sendTextMessage(phone, msg);
};

const updateLeadStatus = async (phone, leadId, status) => {
    try {
        const lead = await Lead.findById(leadId.trim());
        if (!lead) return whatsappService.sendTextMessage(phone, `❌ Lead not found.`);
        lead.status = status.toLowerCase().replace(/ /g, '_');
        await lead.save();
        await whatsappService.sendTextMessage(phone, `✅ Lead ${leadId} updated to *${status}*`);
    } catch { await whatsappService.sendTextMessage(phone, `❌ Invalid lead ID.`); }
};

const updatePropertyField = async (phone, propertyId, field, value) => {
    try {
        const prop = await Property.findById(propertyId.trim());
        if (!prop) return whatsappService.sendTextMessage(phone, `❌ Property not found.`);

        let parsedVal = value;
        if (field === 'price') {
            const v = value.toLowerCase();
            if (v.includes('cr')) parsedVal = parseFloat(v) * 10000000;
            else if (v.includes('l')) parsedVal = parseFloat(v) * 100000;
            else parsedVal = parseFloat(v);
        }

        prop[field] = parsedVal;
        await prop.save();
        await whatsappService.sendTextMessage(phone, `✅ Property ${propertyId}\n*${field}* updated to *${parsedVal}*`);
    } catch { await whatsappService.sendTextMessage(phone, `❌ Failed to update property.`); }
};

// ── ADD PROPERTY FLOW ──
const showProperties = async (phone) => {
    const properties = await Property.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(10);
    let msg = `🏠 *PROPERTIES (Approved)*\n\n`;
    properties.forEach((p, i) => msg += `${i + 1}. *${p.title}* (${p._id})\n   📍 ${p.location} | 💰 ${formatCurrency(p.price)}\n\n`);
    await whatsappService.sendTextMessage(phone, msg);
};

const startAddProperty = async (phone, user) => {
    user.conversationState = { flow: 'admin_add_property', step: 'ask_title', data: { images: [], videos: [] } };
    await user.save();
    await whatsappService.sendTextMessage(phone, `🏠 *Add New Property*\n\n📝 Enter property *title*:\n\nType *cancel* to go back.`);
};

const handleAdminAddPropertyFlow = async (phone, text, user) => {
    if (text.toLowerCase() === 'cancel') { user.conversationState = {}; await user.save(); return showAdminMenu(phone); }
    const d = user.conversationState.data;
    switch (user.conversationState.step) {
        case 'ask_title':
            d.title = text; user.conversationState.step = 'ask_type'; await user.save();
            await whatsappService.sendTextMessage(phone, `📝 Title: *${text}* ✅\n\n🏠 Type: (apartment/villa/plot/commercial/farmhouse)`); break;
        case 'ask_type':
            d.type = text.toLowerCase(); user.conversationState.step = 'ask_price'; await user.save();
            await whatsappService.sendTextMessage(phone, `🏠 Type: *${d.type}* ✅\n\n💰 Enter *price* (e.g., 50L, 1.2Cr):`); break;
        case 'ask_price':
            const v = text.toLowerCase();
            d.price = v.includes('cr') ? parseFloat(v) * 10000000 : (v.includes('l') ? parseFloat(v) * 100000 : parseFloat(v));
            user.conversationState.step = 'ask_location'; await user.save();
            await whatsappService.sendTextMessage(phone, `💰 Price: *${formatCurrency(d.price)}* ✅\n\n📍 Enter *location*:`); break;
        case 'ask_location':
            d.location = text; user.conversationState.step = 'ask_area'; await user.save();
            await whatsappService.sendTextMessage(phone, `📍 Location: *${text}* ✅\n\n📐 Context *area* (e.g., 1200 sqft):`); break;
        case 'ask_area':
            d.area = parseFloat(text) || 0; user.conversationState.step = 'ask_description'; await user.save();
            await whatsappService.sendTextMessage(phone, `📐 Area: *${text}* ✅\n\n📝 Enter *description*:`); break;
        case 'ask_description':
            d.description = text; user.conversationState.step = 'ask_media'; await user.save();
            await whatsappService.sendTextMessage(phone, `📝 Description saved ✅\n\n📸 Send images/videos, or type *done*`); break;
        case 'ask_media':
            if (text.toLowerCase() === 'done' || text.toLowerCase() === 'skip') {
                await Property.create({ title: d.title, type: d.type, price: d.price, location: d.location, area: d.area, description: d.description, images: d.images || [], videos: d.videos || [], status: 'approved', addedBy: user._id });
                user.conversationState = {}; await user.save();
                await whatsappService.sendTextMessage(phone, `✅ *Property Added Successfully!*\n🏠 ${d.title}\n📍 ${d.location} | 💰 ${formatCurrency(d.price)}`);
            } else await whatsappService.sendTextMessage(phone, `📸 Send images/videos, or type *done*`);
            break;
    }
};

const approveAgent = async (phone, agentPhone) => {
    let cp = agentPhone.replace(/\s/g, '');
    if (!cp.startsWith('+')) cp = cp.length === 10 ? '+91' + cp : '+' + cp;
    const agent = await Agent.findOne({ phone: cp });
    if (!agent) return whatsappService.sendTextMessage(phone, `❌ Agent not found: ${cp}`);
    agent.status = 'approved'; await agent.save();
    await whatsappService.sendTextMessage(phone, `✅ Agent *${agent.name}* approved!`);
    try { await whatsappService.sendTextMessage(cp, `🎉 *Congratulations!*\nYour registration is approved. Type *MENU* to access dashboard.`); } catch (e) { }
};

const rejectAgent = async (phone, agentPhone) => {
    let cp = agentPhone.replace(/\s/g, '');
    if (!cp.startsWith('+')) cp = cp.length === 10 ? '+91' + cp : '+' + cp;
    const agent = await Agent.findOne({ phone: cp });
    if (agent) { agent.status = 'rejected'; await agent.save(); await whatsappService.sendTextMessage(phone, `❌ Agent *${agent.name}* rejected.`); }
};

const approveProperty = async (phone, propertyId) => {
    try {
        const prop = await Property.findById(propertyId.trim());
        if (prop) { prop.status = 'approved'; await prop.save(); await whatsappService.sendTextMessage(phone, `✅ Property *${prop.title}* approved!`); }
    } catch (e) { await whatsappService.sendTextMessage(phone, `❌ Invalid ID.`); }
};

const handleAdminMedia = async (phone, mediaKey, mediaType, user) => {
    if (user.conversationState?.flow === 'admin_add_property' && user.conversationState?.step === 'ask_media') {
        user.conversationState.data[mediaType === 'video' ? 'videos' : 'images'].push(mediaKey);
        await user.save();
        await whatsappService.sendTextMessage(phone, `✅ ${mediaType} uploaded! Send more or type *done*`);
        return true;
    }
    return false;
};

module.exports = { handleAdminMessage, handleAdminMedia };
