const express = require('express');
const router = express.Router();
const multer = require('multer');
const Project = require('../models/Project');
const TeamMember = require('../models/TeamMember');
const Testimonial = require('../models/Testimonial');
const Property = require('../models/Property');
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
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/team/:id', upload.any(), async (req, res) => {
    try {
        const data = await processUploads(req, { ...req.body });
        const member = await TeamMember.findByIdAndUpdate(req.params.id, data, { new: true });
        res.json(member);
    } catch (e) { res.status(400).json({ error: e.message }); }
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
        // Only return available, approved properties with public-facing data
        let properties = await Property.find({ status: 'approved', isAvailable: true })
            .select('title description type price location area unit pricePerSqft highlights images bedrooms amenities status isAvailable')
            .sort({ createdAt: -1 });

        // The images inside these properties need to be signed
        properties = await appendSignedUrls(properties);

        res.json(properties);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
