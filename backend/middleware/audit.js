const AuditLog = require('../models/AuditLog');

const audit = (action, resource) => {
    return async (req, res, next) => {
        const originalSend = res.json.bind(res);
        res.json = async function (body) {
            try {
                if (res.statusCode < 400) {
                    await AuditLog.create({
                        userId: req.user?._id,
                        action,
                        resource,
                        resourceId: req.params.id || body?._id,
                        details: {
                            method: req.method,
                            path: req.originalUrl,
                            body: req.method !== 'GET' ? req.body : undefined,
                        },
                        ipAddress: req.ip,
                        userAgent: req.get('user-agent'),
                    });
                }
            } catch (err) {
                console.error('Audit log error:', err.message);
            }
            return originalSend(body);
        };
        next();
    };
};

module.exports = { audit };
