const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const TeamMember = require('../models/TeamMember');
const Testimonial = require('../models/Testimonial');
const Property = require('../models/Property');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { requireOtpForCms } = require('../middleware/otpVerify');
const logger = require('../utils/logger');

// Middleware to conditionally apply auth for POST/PUT/DELETE, but keep GET public for the frontends
const optionalAuth = (req, res, next) => {
    if (req.method === 'GET') {
        return next();
    }
    // Require standard admin auth AND the 6-digit WhatsApp OTP validation
    return auth(req, res, () => authorize('admin')(req, res, () => requireOtpForCms(req, res, next)));
};

router.use(optionalAuth);

// ── PROJECTS ──
router.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find({ isPublished: true }).sort({ createdAt: -1 });
        res.json(projects);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects', async (req, res) => {
    try {
        const project = await Project.create({ ...req.body, addedBy: req.user._id });
        res.status(201).json(project);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
        const members = await TeamMember.find({ isPublished: true }).sort({ createdAt: -1 });
        res.json(members);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/team', async (req, res) => {
    try {
        const member = await TeamMember.create(req.body);
        res.status(201).json(member);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/team/:id', async (req, res) => {
    try {
        const member = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
        const testimonials = await Testimonial.find({ isPublished: true }).sort({ createdAt: -1 });
        res.json(testimonials);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/testimonials', async (req, res) => {
    try {
        const testimonial = await Testimonial.create(req.body);
        res.status(201).json(testimonial);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/testimonials/:id', async (req, res) => {
    try {
        const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
        const properties = await Property.find({ status: 'approved', isAvailable: true })
            .select('title description type price location area unit pricePerSqft highlights images bedrooms amenities status isAvailable')
            .sort({ createdAt: -1 });
        res.json(properties);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
