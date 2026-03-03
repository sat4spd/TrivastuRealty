/**
 * financialEngine.js
 * Real Estate Financial Calculations (EMI, ROI, Stamp Duty, Acquisition Cost)
 */

// Average stamp duty in Jharkhand is ~4-6% for women/men, 1% registration. 
// Using 6% to be safe + 1% registration = 7% total.
const STAMP_DUTY_RATE = 0.06;
const REGISTRATION_RATE = 0.01;

/**
 * Calculate basic EMI
 * @param {number} principal Loan amount in INR
 * @param {number} rate Annual interest rate (e.g., 8.5)
 * @param {number} tenureYears Number of years
 * @returns {number} Monthly EMI
 */
const calculateEMI = (principal, rate, tenureYears) => {
    if (!principal || !rate || !tenureYears) return 0;
    const r = (rate / 12) / 100;
    const n = tenureYears * 12;
    const emi = principal * r * (Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
    return Math.round(emi);
};

/**
 * Calculate total acquisition cost including stamp duty and registration
 * @param {number} propertyPrice Base property price
 * @returns {object} Breakdown of costs
 */
const calculateAcquisitionCost = (propertyPrice) => {
    if (!propertyPrice) return null;
    const stampDuty = Math.round(propertyPrice * STAMP_DUTY_RATE);
    const registration = Math.round(propertyPrice * REGISTRATION_RATE);
    const totalCost = propertyPrice + stampDuty + registration;

    return {
        basePrice: propertyPrice,
        stampDuty: stampDuty,
        registration: registration,
        totalCost: totalCost,
        remarks: "Calculated based on approx 6% Stamp Duty and 1% Registration in Jharkhand."
    };
};

/**
 * Estimate Gross Rental Yield
 * @param {number} propertyPrice Base price of the property
 * @param {number} expectedMonthlyRent Expected rent per month
 * @returns {number} Annual yield percentage
 */
const calculateRentalYield = (propertyPrice, expectedMonthlyRent) => {
    if (!propertyPrice || !expectedMonthlyRent) return 0;
    const annualRent = expectedMonthlyRent * 12;
    const yieldPercent = (annualRent / propertyPrice) * 100;
    return parseFloat(yieldPercent.toFixed(2));
};

/**
 * Financial Simulation Toolkit available to the LLM
 */
const financialTools = {
    calculateEMI,
    calculateAcquisitionCost,
    calculateRentalYield
};

module.exports = {
    STAMP_DUTY_RATE,
    REGISTRATION_RATE,
    calculateEMI,
    calculateAcquisitionCost,
    calculateRentalYield,
    financialTools
};
