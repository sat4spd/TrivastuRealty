const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
// In production show DEBUG so webhook/message activity appears in dashboard logs
const currentLevel = LOG_LEVELS.DEBUG;

const timestamp = () => new Date().toISOString();

let io = null;
const setSocketIO = (socketIO) => {
    io = socketIO;
};

const emitLog = (level, ...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    const formatted = `[${timestamp()}] ${level}: ${msg}`;

    // Console output
    if (level === 'ERROR') console.error(formatted);
    else if (level === 'WARN') console.warn(formatted);
    else console.log(formatted);

    // Emit to dashboard — use clean level name for frontend filtering
    if (io) {
        const cleanLevel = level.replace(/[^A-Za-z]/g, '').toUpperCase();
        io.emit('system_log', {
            timestamp: new Date(),
            level: cleanLevel,  // e.g. 'ERROR', 'INFO', 'DEBUG', 'WARN'
            message: msg,
            raw: formatted
        });
    }
};

const logger = {
    error: (...args) => currentLevel >= LOG_LEVELS.ERROR && emitLog('❌ ERROR', ...args),
    warn: (...args) => currentLevel >= LOG_LEVELS.WARN && emitLog('⚠️  WARN', ...args),
    info: (...args) => currentLevel >= LOG_LEVELS.INFO && emitLog('ℹ️  INFO', ...args),
    debug: (...args) => currentLevel >= LOG_LEVELS.DEBUG && emitLog('🐛 DEBUG', ...args),
    setSocketIO,
};

module.exports = logger;
