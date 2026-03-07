const express = require('express');
const multer = require('multer');
const Property = require('../models/Property');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { requireOtpForCms } = require('../middleware/otpVerify');
const { uploadFile, getSignedDownloadUrl } = require('../services/s3Service');
const { notifyAdmin, ALERT_TYPES } = require('../services/notificationService');
const logger = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/properties/:id/public — No auth required, for shareable property page
router.get('/:id/public', async (req, res) => {
    try {
        const property = await Property.findById(req.params.id).lean();
        if (!property || property.status !== 'approved') {
            return res.status(404).json({ error: 'Property not found or not available' });
        }
        res.json({ property });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch property' });
    }
});

// GET /api/properties — List properties (auth required)
router.get('/', auth, async (req, res) => {
    try {
        const { status, type, location, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
        const query = {};

        if (req.user.role !== 'admin') {
            query.status = 'approved';
            query.isAvailable = true;
        } else if (status) {
            query.status = status;
        }

        if (type) query.type = type;
        if (location) query.location = { $regex: location, $options: 'i' };
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }

        const properties = await Property.find(query)
            .populate('addedBy', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        // Generate signed URLs for media
        for (const prop of properties) {
            if (prop.media?.length > 0) {
                for (const m of prop.media) {
                    if (m.key) {
                        try {
                            m.url = await getSignedDownloadUrl(m.key);
                        } catch (e) { /* ignore */ }
                    }
                }
            }
        }

        const total = await Property.countDocuments(query);
        res.json({ properties, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        logger.error('Get properties error:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});

// GET /api/properties/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const property = await Property.findById(req.params.id).populate('addedBy', 'name');
        if (!property) return res.status(404).json({ error: 'Property not found' });

        const propObj = property.toObject();
        if (propObj.media?.length > 0) {
            for (const m of propObj.media) {
                if (m.key) {
                    try { m.url = await getSignedDownloadUrl(m.key); } catch (e) { /* ignore */ }
                }
            }
        }

        res.json(propObj);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch property' });
    }
});

// POST /api/properties — Create property
router.post('/', auth, authorize('admin', 'agent'), upload.array('images', 10), audit('create', 'property'), async (req, res) => {
    try {
        const { title, description, type, price, location, area, unit, agentCommissionRate, bedrooms, amenities, projectName } = req.body;

        const media = [];
        if (req.files?.length > 0) {
            for (const file of req.files) {
                const result = await uploadFile(file.buffer, file.originalname, 'properties');
                media.push({ key: result.key, type: 'image' });
            }
        }

        const property = await Property.create({
            title, description, type,
            price: parseInt(price),
            location,
            area: Number(area),
            unit: unit || 'sqft',
            totalArea: Number(area),
            availableArea: Number(area),
            agentCommissionRate: Number(agentCommissionRate) || 2.0,
            bedrooms: parseInt(bedrooms) || 0,
            amenities: amenities ? (typeof amenities === 'string' ? amenities.split(',') : amenities) : [],
            media,
            addedBy: req.user._id,
            status: req.user.role === 'admin' ? 'approved' : 'pending',
            approvedBy: req.user.role === 'admin' ? req.user._id : undefined,
            approvedAt: req.user.role === 'admin' ? new Date() : undefined,
            projectName,
        });

        if (req.user.role !== 'admin') {
            await notifyAdmin(ALERT_TYPES.PROPERTY_UPLOAD, {
                title, price: parseInt(price), location, agentName: req.user.name,
            });
        }

        res.status(201).json(property);
    } catch (error) {
        logger.error('Create property error:', error);
        res.status(500).json({ error: 'Failed to create property' });
    }
});

// PUT /api/properties/:id — Update property
router.put('/:id', auth, authorize('admin'), requireOtpForCms, audit('update', 'property'), async (req, res) => {
    try {
        const property = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.json(property);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update property' });
    }
});

// PUT /api/properties/:id/approve — Approve/Reject property
router.put('/:id/approve', auth, authorize('admin'), requireOtpForCms, audit('approve', 'property'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const property = await Property.findByIdAndUpdate(
            req.params.id,
            {
                status,
                approvedBy: req.user._id,
                approvedAt: new Date(),
            },
            { new: true }
        );

        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.json(property);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update property status' });
    }
});

// DELETE /api/properties/:id
router.delete('/:id', auth, authorize('admin'), requireOtpForCms, audit('delete', 'property'), async (req, res) => {
    try {
        const property = await Property.findByIdAndDelete(req.params.id);
        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.json({ message: 'Property deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete property' });
    }
});

module.exports = router;
