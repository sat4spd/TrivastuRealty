const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const Campaign = require('../models/Campaign');
const CampaignLog = require('../models/CampaignLog');
const whatsappService = require('../services/whatsappService');
const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const { parsePhone } = require('../utils/helpers');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Parse files in memory

// In-memory control flags for stopping campaigns
const activeCampaigns = new Set();

// ── 1. UPLOAD EXCEL AUDIENCE ──
router.post('/upload', auth, authorize('admin', 'manager'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No Excel file uploaded' });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON (Expects row 1 to have headers like 'Name' and 'Phone')
        const rawData = xlsx.utils.sheet_to_json(sheet);
        
        const contacts = [];
        let validCount = 0;
        let invalidCount = 0;

        for (const row of rawData) {
            // Flexible column matching (case insensitive)
            const getCol = (keys) => {
                const key = Object.keys(row).find(k => keys.includes(k.toLowerCase().replace(/[^a-z0-9]/g, '')));
                return key ? row[key] : null;
            };

            let name = getCol(['name', 'firstname', 'fullname', 'customer']) || '';
            let rawPhone = getCol(['phone', 'whatsapp', 'number', 'mobile', 'contact']);

            if (rawPhone) {
                const parsedPhone = parsePhone(String(rawPhone));
                if (parsedPhone) {
                    contacts.push({ name: String(name).trim(), phone: parsedPhone });
                    validCount++;
                } else {
                    invalidCount++;
                }
            } else {
                invalidCount++;
            }
        }

        res.json({
            success: true,
            totalRows: rawData.length,
            validContacts: validCount,
            invalidContacts: invalidCount,
            sample: contacts.slice(0, 5),
            contacts // Send back parsed data to frontend state
        });

    } catch (error) {
        logger.error('Excel parse error:', error);
        res.status(500).json({ error: 'Failed to parse Excel file' });
    }
});

// ── 2. GENERATE AI MARKETING MESSAGE ──
router.post('/generate-ai', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an elite, high-converting real estate marketing copywriter for Trivastu Realty. Combine premium luxury language with urgent FOMO. Write a highly persuasive WhatsApp broadcast message based on the user's prompt. Rules: 1. Keep it under 60 words for quick reading. 2. Use strategic grouping of matching emojis (e.g. 🏢✨). 3. Use bold formatting *like this* for prices, locations, and the core offer. 4. Focus strictly on benefits (ROI, lifestyle, savings). 5. End with a very clear, low-friction Call To Action to reply or click 'I am interested'. Do NOT use brackets like [Name] or [Link]. Make it sound remarkably human and highly exclusive."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 250,
        });

        res.json({ message: response.choices[0].message.content });
    } catch (error) {
        logger.error('AI generation error:', error);
        res.status(500).json({ error: 'Failed to generate AI message' });
    }
});

// ── 2.5 GET META TEMPLATES ──
router.get('/templates', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const templates = await whatsappService.getTemplates();
        res.json(templates);
    } catch (error) {
        logger.error('Failed to fetch Meta templates', error);
        res.status(500).json({ error: 'Failed to fetch Meta templates' });
    }
});

// ── 3. START CAMPAIGN (ASYNC BACKGROUND TASK) ──
router.post('/start', auth, authorize('admin', 'manager'), audit('start', 'campaign'), async (req, res) => {
    try {
        const { campaignName, contacts, messageText } = req.body;
        
        if (!contacts || contacts.length === 0) return res.status(400).json({ error: 'Audience list is empty' });
        if (!messageText) return res.status(400).json({ error: 'Message content is required' });

        // 1. Create DB Record
        const campaign = await Campaign.create({
            name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
            totalRecipients: contacts.length,
            messageTemplate: messageText,
            status: 'running',
            createdBy: req.user._id
        });

        const campaignId = campaign._id.toString();
        activeCampaigns.add(campaignId);

        // 2. Return Response Immediately
        res.status(200).json({ success: true, campaignId, message: 'Campaign started in background' });

        // 3. Process Queue Async (Anti-Ban Execution Loop)
        (async () => {
            let sent = 0;
            let failed = 0;

            for (const contact of contacts) {
                // Check if campaign was stopped by admin midway
                if (!activeCampaigns.has(campaignId)) {
                    logger.info(`⛔ Campaign ${campaignId} was manually stopped.`);
                    break; 
                }

                try {
                    // Personalize template (replace {{name}} if exists)
                    let personalizedMsg = messageText;
                    if (contact.name) {
                        personalizedMsg = personalizedMsg.replace(/\{\{name\}\}/gi, contact.name);
                    } else {
                        personalizedMsg = personalizedMsg.replace(/\{\{name\}\}/gi, 'there');
                    }

                    // Send WhatsApp Message (interactive buttons for better conversion/opt-out)
                    await whatsappService.sendInteractiveButtons(
                        contact.phone,
                        personalizedMsg,
                        [
                            { id: 'marketing_interested', title: '✅ I am interested' },
                            { id: 'marketing_optout', title: '🛑 Stop messages' }
                        ]
                    );

                    await CampaignLog.create({
                        campaignId,
                        phone: contact.phone,
                        name: contact.name,
                        status: 'success',
                        sentAt: new Date()
                    });
                    sent++;

                } catch (err) {
                    await CampaignLog.create({
                        campaignId,
                        phone: contact.phone,
                        name: contact.name,
                        status: 'failed',
                        errorReason: err.message
                    });
                    failed++;
                }

                // Update living tracker in DB every 10 messages to avoid DB lock
                if ((sent + failed) % 10 === 0) {
                    await Campaign.findByIdAndUpdate(campaignId, { sentCount: sent, failedCount: failed });
                }

                // 🌟 VITAL: DELAY TO PREVENT WHATSAPP BAN (2.5 - 4 seconds random) 🌟
                const jitter = Math.floor(Math.random() * 1500) + 2500;
                await new Promise(resolve => setTimeout(resolve, jitter));
            }

            // Finished loop (or stopped early)
            const finalStatus = activeCampaigns.has(campaignId) ? 'completed' : 'stopped';
            await Campaign.findByIdAndUpdate(campaignId, { 
                status: finalStatus, 
                sentCount: sent, 
                failedCount: failed 
            });
            activeCampaigns.delete(campaignId);

            logger.info(`✅ Campaign ${campaignId} ${finalStatus}. Sent: ${sent}, Failed: ${failed}`);

        })(); // Immediately Invoked Async Function

    } catch (error) {
        logger.error('Failed to start campaign:', error);
        res.status(500).json({ error: 'Failed to start campaign' });
    }
});

// ── 4. STOP CAMPAIGN ──
router.post('/stop/:id', auth, authorize('admin', 'manager'), audit('stop', 'campaign'), async (req, res) => {
    try {
        const { id } = req.params;
        if (activeCampaigns.has(id)) {
            activeCampaigns.delete(id); // Next loop iteration will see this and break
            await Campaign.findByIdAndUpdate(id, { status: 'stopped' });
            res.json({ success: true, message: 'Campaign stopping protocol initiated' });
        } else {
            res.status(400).json({ error: 'Campaign not found or not currently running' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to stop campaign' });
    }
});

// ── 5. GET ACTIVE/PAST CAMPAIGNS ──
router.get('/', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(20).lean();
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// ── 6. GET CAMPAIGN REPORT CSV (LOGS) ──
router.get('/report/:id', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const logs = await CampaignLog.find({ campaignId: req.params.id }).sort({ sentAt: -1 }).lean();
        
        // Convert JSON to CSV manually
        let csv = 'Phone,Name,Status,Error Reason,Sent At\n';
        for (const log of logs) {
            csv += `${log.phone},${log.name || ''},${log.status},${log.errorReason || ''},${log.sentAt ? log.sentAt.toISOString() : ''}\n`;
        }

        res.header('Content-Type', 'text/csv');
        res.attachment(`Campaign_Report_${req.params.id}.csv`);
        res.send(csv);

    } catch (error) {
        logger.error('Failed to generate report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

module.exports = router;
