require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { apiLimiter, webhookLimiter } = require('./middleware/rateLimiter');
const { setSocketIO } = require('./services/notificationService');
const { startBackupService } = require('./services/backupService');
const { scheduleAgentBriefing } = require('./crons/agentBriefingJob');
const { scheduleFollowUps } = require('./crons/followUpJob');
const logger = require('./utils/logger');

// Import routes
const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const propertyRoutes = require('./routes/properties');
const leadRoutes = require('./routes/leads');
const broadcastRoutes = require('./routes/broadcast');
const groupRoutes = require('./routes/groups');
const documentsRoutes = require('./routes/documents');
const analyticsRoutes = require('./routes/analytics');
const chatRoutes = require('./routes/chats');
const cmsRoutes = require('./routes/cms');

const app = express();
const httpServer = createServer(app);

// ── 1. BODY PARSING (TOP PRIORITY) ────────────────────────────────────
// These must be at the very top to ensure req.body is populated
// before any other middleware or rate limiters run.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── 2. TRUST PROXY ───────────────────────────────────────────────────
app.set('trust proxy', 1);

// ── 3. LOGGING ────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ── 4. CORS CONFIGURATION ─────────────────────────────────────────────
const allowedOrigins = [
    'https://admin.trivastu.com',
    'https://realty.trivastu.com',
    'https://plot.trivastu.com',
    'https://trivastu.com',
    'https://www.trivastu.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS Policy Error'), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-otp-code']
}));

// ── 5. SECURITY HEADERS (HELMET) ──────────────────────────────────────
app.use((req, res, next) => {
    if (req.path.startsWith('/webhook')) return next();
    helmet({
        contentSecurityPolicy: false, // Managed by Nginx
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })(req, res, next);
});

// ── 6. DEBUG LOGGING ──────────────────────────────────────────────────
app.use((req, res, next) => {
    if (req.method === 'POST') {
        const bodyKeys = req.body ? Object.keys(req.body) : 'null/undefined';
        logger.debug(`[SERVER] POST ${req.path} | Content-Type: ${req.headers['content-type']} | Keys: ${bodyKeys}`);
    }
    next();
});

// Socket.io setup
const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
});

setSocketIO(io);
logger.setSocketIO(io);
require('./services/chatLogger').setSocketIO(io);

io.on('connection', (socket) => {
    logger.info(`Dashboard client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        logger.debug(`Dashboard client disconnected: ${socket.id}`);
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({ name: 'Trivastu Realty API', status: 'running' });
});

// Routes
app.use('/webhook', webhookLimiter, webhookRoutes);
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/agents', apiLimiter, agentRoutes);
app.use('/api/properties', apiLimiter, propertyRoutes);
app.use('/api/leads', apiLimiter, leadRoutes);
app.use('/api/broadcast', apiLimiter, broadcastRoutes);
app.use('/api/groups', apiLimiter, groupRoutes);
app.use('/api/documents', apiLimiter, documentsRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);
app.use('/api/chats', apiLimiter, chatRoutes);
app.use('/api/cms', apiLimiter, cmsRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;

const start = async () => {
    await connectDB();
    httpServer.listen(PORT, () => {
        logger.info(`🚀 Trivastu Realty Backend running on port ${PORT}`);
        startBackupService();
        scheduleAgentBriefing();
        scheduleFollowUps();
    });
};

start().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
