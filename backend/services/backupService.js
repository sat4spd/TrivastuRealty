const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Ensure backups directory exists
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const performBackup = async () => {
    logger.info('Starting automated database backup...');
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

        const backupData = {};

        // Loop through all registered Mongoose models
        const models = mongoose.models;
        for (const [modelName, model] of Object.entries(models)) {
            const data = await model.find({}).lean();
            backupData[modelName] = data;
        }

        // Save to file
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        logger.info(`Backup successful. Saved to ${backupFile}`);

        // Rotate backups - Keep only last 3 days (3 files, assuming 1 per day)
        rotateBackups(3);
    } catch (error) {
        logger.error('Database backup failed:', error.message);
    }
};

const rotateBackups = (maxFiles) => {
    try {
        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(backupDir, file),
                time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first

        // Delete files beyond the max limit
        if (files.length > maxFiles) {
            const filesToDelete = files.slice(maxFiles);
            for (const file of filesToDelete) {
                fs.unlinkSync(file.path);
                logger.info(`Deleted old backup: ${file.name}`);
            }
        }
    } catch (error) {
        logger.error('Failed to rotate backups:', error.message);
    }
};

// Start the 24-hour backup interval
const startBackupService = () => {
    // Run once on startup just to have an initial snapshot
    performBackup();

    // 24 hours in milliseconds
    const intervals24h = 24 * 60 * 60 * 1000;
    setInterval(performBackup, intervals24h);

    logger.info('Automated 24-hour database backup service started.');
};

module.exports = { startBackupService, performBackup };
