const User = require('../models/User');
const Agent = require('../models/Agent');
const logger = require('../utils/logger');
const { parsePhone } = require('../utils/helpers');

const detectRole = async (phone) => {
    const normalizedPhone = parsePhone(phone);

    // Check if admin — support multiple admin numbers
    const adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || process.env.ADMIN_WHATSAPP_NUMBER || '')
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);

    if (adminNumbers.includes(normalizedPhone)) {
        let adminUser = await User.findOne({ phone: normalizedPhone });
        if (!adminUser) {
            adminUser = await User.create({
                phone: normalizedPhone,
                name: 'Admin',
                role: 'admin',
            });
        } else if (adminUser.role !== 'admin') {
            adminUser.role = 'admin';
            await adminUser.save();
        }
        return { role: 'admin', user: adminUser };
    }

    // Check existing user
    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
        return { role: 'new_user', user: null };
    }

    // Check if agent
    if (user.role === 'agent') {
        const agent = await Agent.findOne({ userId: user._id });
        if (agent) {
            if (agent.status === 'approved') {
                return { role: 'approved_agent', user, agent };
            }
            if (agent.status === 'pending') {
                return { role: 'pending_agent', user, agent };
            }
            if (agent.status === 'suspended') {
                return { role: 'suspended_agent', user, agent };
            }
            if (agent.status === 'rejected') {
                return { role: 'rejected_agent', user, agent };
            }
        }
    }

    // Existing customer
    return { role: 'customer', user };
};

module.exports = { detectRole };
