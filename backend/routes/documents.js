const express = require('express');
const multer = require('multer');
const { auth } = require('../middleware/auth');
const { uploadFile, getSignedDownloadUrl } = require('../services/s3Service');
const logger = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/documents/upload
router.post('/upload', auth, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { docType } = req.body; // aadhaar, pan, booking_receipt, etc.
        const folder = `documents/${req.user._id}/${docType || 'general'}`;

        const result = await uploadFile(
            req.file.buffer,
            req.file.originalname,
            folder,
            process.env.S3_BUCKET_CUSTOMER_DOCS
        );

        res.json({
            message: 'Document uploaded successfully',
            key: result.key,
            docType,
        });
    } catch (error) {
        logger.error('Document upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// GET /api/documents/:key/url — Get signed URL
router.get('/:key(*)/url', auth, async (req, res) => {
    try {
        const url = await getSignedDownloadUrl(req.params.key, process.env.S3_BUCKET_CUSTOMER_DOCS);
        res.json({ url });
    } catch (error) {
        logger.error('Document URL error:', error);
        res.status(500).json({ error: 'Failed to generate URL' });
    }
});

module.exports = router;
