const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/s3');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const uploadFile = async (buffer, originalName, folder, bucket) => {
    const bucketName = bucket || process.env.S3_BUCKET_PROPERTY_MEDIA;
    const ext = originalName.split('.').pop();
    const key = `${folder}/${uuidv4()}.${ext}`;

    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: getContentType(ext),
            ServerSideEncryption: 'AES256',
        }));
        logger.info(`File uploaded to S3: ${key}`);
        return { key, bucket: bucketName };
    } catch (error) {
        logger.error('S3 upload error:', error.message);
        throw error;
    }
};

const getSignedDownloadUrl = async (key, bucket, expiresIn = 3600) => {
    const bucketName = bucket || process.env.S3_BUCKET_PROPERTY_MEDIA;
    try {
        const url = await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: bucketName, Key: key }),
            { expiresIn }
        );
        return url;
    } catch (error) {
        logger.error('S3 signed URL error:', error.message);
        throw error;
    }
};

const deleteFile = async (key, bucket) => {
    const bucketName = bucket || process.env.S3_BUCKET_PROPERTY_MEDIA;
    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        }));
        logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
        logger.error('S3 delete error:', error.message);
        throw error;
    }
};

const getContentType = (ext) => {
    const types = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
        mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
        pdf: 'application/pdf', doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return types[ext?.toLowerCase()] || 'application/octet-stream';
};

// Upload a raw buffer with a given S3 key and content type
const uploadBuffer = async (buffer, key, contentType) => {
    const bucketName = process.env.S3_BUCKET_PROPERTY_MEDIA;
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType || 'application/octet-stream',
            ServerSideEncryption: 'AES256',
        }));
        logger.info(`Buffer uploaded to S3: ${key}`);
        return { key, bucket: bucketName };
    } catch (error) {
        logger.error('S3 buffer upload error:', error.message);
        throw error;
    }
};

module.exports = {
    uploadFile,
    uploadBuffer,
    getSignedDownloadUrl,
    getSignedUrl: getSignedDownloadUrl, // alias
    deleteFile,
};

