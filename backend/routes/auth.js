const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = await User.findOne({ email, role: 'admin' });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.passwordHash) {
            // First login: set password
            user.passwordHash = await bcrypt.hash(password, 10);
            await user.save();
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user._id);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/setup — Initial admin setup
router.post('/setup', async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin && existingAdmin.passwordHash) {
            return res.status(400).json({ error: 'Admin already configured' });
        }

        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        let admin = existingAdmin || new User();
        admin.email = email;
        admin.name = name || 'Admin';
        admin.role = 'admin';
        admin.phone = process.env.ADMIN_WHATSAPP_NUMBER;
        admin.passwordHash = await bcrypt.hash(password, 10);
        await admin.save();

        const token = generateToken(admin._id);
        res.json({
            message: 'Admin setup complete',
            token,
            user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
        });
    } catch (error) {
        logger.error('Setup error:', error);
        res.status(500).json({ error: 'Setup failed' });
    }
});

module.exports = router;
