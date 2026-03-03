const WHATSAPP_API_URL = 'https://graph.facebook.com/v22.0';

const whatsappConfig = {
    apiUrl: `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}`,
    token: process.env.WHATSAPP_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
};

module.exports = whatsappConfig;
