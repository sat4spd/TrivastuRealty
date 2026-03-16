const express = require('express');
const router = express.Router();
const multer = require('multer');
const Project = require('../models/Project');
const TeamMember = require('../models/TeamMember');
const Testimonial = require('../models/Testimonial');
const Property = require('../models/Property');
const Service = require('../models/Service');
const BusinessInfo = require('../models/BusinessInfo');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { requireOtpForCms } = require('../middleware/otpVerify');
const { uploadFile, getSignedDownloadUrl } = require('../services/s3Service');
const logger = require('../utils/logger');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Middleware to conditionally apply auth for POST/PUT/DELETE, but keep GET public for the frontends
const optionalAuth = (req, res, next) => {
    if (req.method === 'GET') {
        return next();
    }
    return auth(req, res, () => authorize('admin')(req, res, () => requireOtpForCms(req, res, next)));
};

router.use(optionalAuth);

// Helper to append signed URLs
const appendSignedUrls = async (docs) => {
    const list = docs.map(d => d.toObject ? d.toObject() : d);
    for (const doc of list) {
        if (doc.image && !doc.image.startsWith('http')) {
            try { doc.image = await getSignedDownloadUrl(doc.image); } catch (e) { }
        }
        if (doc.images && doc.images.length > 0) {
            const signed = [];
            for (const img of doc.images) {
                if (img.startsWith('http')) signed.push(img);
                else { try { signed.push(await getSignedDownloadUrl(img)); } catch (e) { signed.push(img); } }
            }
            doc.images = signed;
        }
    }
    return list;
};

// Helper to handle uploaded files
const processUploads = async (req, bodyData) => {
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            if (file.fieldname === 'image') {
                const result = await uploadFile(file.buffer, file.originalname, 'cms');
                bodyData.image = result.key;
            } else if (file.fieldname === 'images') {
                const result = await uploadFile(file.buffer, file.originalname, 'cms');
                if (!bodyData.images) bodyData.images = [];
                // if bodyData.images is a string (from FormData iteration), convert to array
                if (typeof bodyData.images === 'string') bodyData.images = [bodyData.images];
                bodyData.images.push(result.key);
            }
        }
    }
    return bodyData;
};

// ── PROJECTS ──
router.get('/projects', async (req, res) => {
    try {
        let projects = await Project.find({ isPublished: true }).sort({ createdAt: -1 });
        projects = await appendSignedUrls(projects);
        res.json(projects);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const project = await Project.create({ ...data, addedBy: req.user._id });
        res.status(201).json(project);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/projects/:id', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const project = await Project.findByIdAndUpdate(req.params.id, data, { new: true });
        res.json(project);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/projects/:id', async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── TEAM MEMBERS ──
router.get('/team', async (req, res) => {
    try {
        let members = await TeamMember.find({ isPublished: true }).sort({ createdAt: -1 });
        members = await appendSignedUrls(members);
        res.json(members);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/team', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const member = await TeamMember.create(data);
        res.status(201).json(member);
    } catch (e) {
        logger.error('CMS Team POST error:', e);
        res.status(400).json({ error: e.message }); 
    }
});

router.put('/team/:id', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const member = await TeamMember.findByIdAndUpdate(req.params.id, data, { new: true });
        res.json(member);
    } catch (e) {
        logger.error('CMS Team PUT error:', e);
        res.status(400).json({ error: e.message }); 
    }
});

router.delete('/team/:id', async (req, res) => {
    try {
        await TeamMember.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── TESTIMONIALS ──
router.get('/testimonials', async (req, res) => {
    try {
        let testimonials = await Testimonial.find({ isPublished: true }).sort({ createdAt: -1 });
        testimonials = await appendSignedUrls(testimonials);
        res.json(testimonials);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/testimonials', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const testimonial = await Testimonial.create(data);
        res.status(201).json(testimonial);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/testimonials/:id', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, data, { new: true });
        res.json(testimonial);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/testimonials/:id', async (req, res) => {
    try {
        await Testimonial.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── PUBLIC PROPERTIES (For Plots & Realty Websites) ──
router.get('/properties', async (req, res) => {
    try {
        const filter = { status: 'approved', isAvailable: true };
        if (req.query.website) filter.website = req.query.website;
        if (req.query.type) filter.type = req.query.type;
        let properties = await Property.find(filter)
            .select('title description type price location area unit pricePerSqft highlights images bedrooms amenities status isAvailable landClassification website')
            .sort({ createdAt: -1 });
        properties = await appendSignedUrls(properties);
        res.json(properties);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SERVICES / PACKAGES ──
router.get('/services', async (req, res) => {
    try {
        const filter = { isPublished: true };
        if (req.query.website) filter.website = req.query.website;
        const services = await Service.find(filter).sort({ order: 1 });
        res.json(services);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/services', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const service = await Service.create(data);
        res.status(201).json(service);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/services/:id', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const service = await Service.findByIdAndUpdate(req.params.id, data, { new: true });
        res.json(service);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/services/:id', async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── BUSINESS INFO (Singleton) ──
router.get('/business-info', async (req, res) => {
    try {
        let info = await BusinessInfo.findOne({ key: 'main' });
        if (!info) info = await BusinessInfo.create({ key: 'main' });
        res.json(info);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/business-info', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        let info = await BusinessInfo.findOneAndUpdate({ key: 'main' }, data, { new: true, upsert: true });
        res.json(info);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── REALTY PROJECTS (Construction projects for realty site) ──
router.get('/realty-projects', async (req, res) => {
    try {
        let projects = await Project.find({ isPublished: true }).sort({ createdAt: -1 });
        projects = await appendSignedUrls(projects);
        res.json(projects);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/realty-projects', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        data.website = 'realty';
        const project = await Project.create(data);
        res.status(201).json(project);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/realty-projects/:id', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const project = await Project.findByIdAndUpdate(req.params.id, data, { new: true });
        res.json(project);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/realty-projects/:id', async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});


// ── WEBSITE CHAT: Public lead capture endpoint ──
// Called when visitor submits name + phone on the website chat widget
router.post('/website-lead', async (req, res) => {
    try {
        const { name, phone, message, source } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number required' });

        const Lead = require('../models/Lead');
        const User = require('../models/User');

        // Find or create user
        let user = await User.findOne({ phone });
        if (!user) {
            user = await User.create({ phone, name: name || 'Website Visitor', role: 'customer' });
        } else if (name && !user.name) {
            user.name = name;
            await user.save();
        }

        // Create lead
        const lead = await Lead.create({
            customerId: user._id,
            source: source || 'website_chat',
            location: 'Unknown',
            budget: 0,
        });

        // Notify admin
        const { notifyAdmin, ALERT_TYPES } = require('../services/notificationService');
        await notifyAdmin(ALERT_TYPES.NEW_LEAD, {
            name: name || phone,
            phone,
            propertyType: 'Website Chat Lead',
            aiScore: 40,
        });

        res.json({ success: true, leadId: lead._id, userId: user._id });
    } catch (e) {
        logger.error('Website lead capture error:', e.message);
        res.status(500).json({ error: 'Failed to capture lead' });
    }
});

// ── WEBSITE CHAT: Public AI chat endpoint ──
// Lightweight chat for website visitors — no WA required
const websiteChatHistory = new Map(); // In-memory session store (resets on restart)
router.post('/chat', async (req, res) => {
    try {
        const { message, sessionId, name } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        const { generateResponse } = require('../services/llmService');

        // Get or create session history
        const key = sessionId || 'anon';
        if (!websiteChatHistory.has(key)) websiteChatHistory.set(key, []);
        const history = websiteChatHistory.get(key);

        // Fetch a few properties for context
        const props = await Property.find({ status: 'approved', isAvailable: true }).limit(5).lean();
        const userProfile = name ? { name } : {};

        const reply = await generateResponse(message, history, userProfile, props);

        // Update history (cap at 10 turns)
        history.push({ role: 'user', content: message });
        history.push({ role: 'assistant', content: reply });
        if (history.length > 20) history.splice(0, 2);
        websiteChatHistory.set(key, history);

        res.json({ reply });
    } catch (e) {
        logger.error('Website chat error:', e.message);
        res.json({ reply: "I'm having trouble right now 😅 Please call us at +91 8655202633 or message us on WhatsApp!" });
    }
});

module.exports = router;
