const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    amount: { type: Number, required: true },
    percentage: { type: Number, required: true },
    propertyPrice: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date },
}, { timestamps: true });

commissionSchema.index({ agentId: 1 });
commissionSchema.index({ status: 1 });

module.exports = mongoose.model('Commission', commissionSchema);
