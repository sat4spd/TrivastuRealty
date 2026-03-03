const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
};

const parsePhone = (phone) => {
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('91') && cleaned.length === 12) {
            cleaned = '+' + cleaned;
        } else if (cleaned.length === 10) {
            cleaned = '+91' + cleaned;
        }
    }
    return cleaned;
};

const sanitizeText = (text) => {
    if (!text) return '';
    return text.trim().substring(0, 500);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { formatCurrency, parsePhone, sanitizeText, delay };
