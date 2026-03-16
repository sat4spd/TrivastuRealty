const formatCurrency = (amount) => {
    if (amount == null || isNaN(amount)) return 'Not specified';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
};

const parsePhone = (phone) => {
    if (!phone) return null;
    // Strip everything except numbers
    let cleaned = String(phone).replace(/[^0-9]/g, '');
    
    // Auto-append +91 for standard 10 digit Indian numbers
    if (cleaned.length === 10) {
        return '+91' + cleaned;
    }
    
    // Auto-append + to 12 digit numbers starting with 91
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return '+' + cleaned;
    }

    // Pass-through anything else formatted with a plus
    if (String(phone).startsWith('+')) {
         return phone.replace(/[^0-9+]/g, '');
    }

    // Fallback: Just return the digits with a plus (assumes country code is included but missing +)
    if (cleaned.length > 10) {
        return '+' + cleaned;
    }

    return null; // Invalid number length
};

const sanitizeText = (text) => {
    if (!text) return '';
    return text.trim().substring(0, 500);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { formatCurrency, parsePhone, sanitizeText, delay };
