const Agent = require('../models/Agent');
const Commission = require('../models/Commission');
const logger = require('../utils/logger');

const calculateCommission = async (agentId, propertyPrice, leadId, propertyId, propertyCommissionRate = null) => {
    const agent = await Agent.findById(agentId);
    if (!agent) throw new Error('Agent not found');

    const rate = propertyCommissionRate !== null ? propertyCommissionRate : agent.commissionPercent;
    const amount = (propertyPrice * rate) / 100;

    const commission = await Commission.create({
        agentId,
        leadId,
        propertyId,
        amount,
        percentage: rate,
        propertyPrice,
        status: 'pending',
    });

    // Update agent totals
    agent.totalDeals += 1;
    agent.totalCommission += amount;
    await agent.save();

    logger.info(`Commission calculated for agent ${agent.name}: ₹${amount}`);
    return commission;
};

const markCommissionPaid = async (commissionId) => {
    const commission = await Commission.findByIdAndUpdate(
        commissionId,
        { status: 'paid', paidAt: new Date() },
        { new: true }
    );
    return commission;
};

const getAgentCommissions = async (agentId) => {
    const commissions = await Commission.find({ agentId })
        .populate('propertyId', 'title price location')
        .populate('leadId')
        .sort({ createdAt: -1 })
        .lean();

    const total = commissions.reduce((sum, c) => sum + c.amount, 0);
    const paid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);

    return { commissions, total, paid, pending: total - paid };
};

module.exports = { calculateCommission, markCommissionPaid, getAgentCommissions };
