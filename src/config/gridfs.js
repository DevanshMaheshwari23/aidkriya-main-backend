const { GridFsStorage } = require('multer-gridfs-storage');
const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

const storage = new GridFsStorage({
  url: process.env.MONGODB_URI,
  file: (req, file) => {
    const userId = req.user?._id?.toString() || 'unknown';
    const timestamp = Date.now();
    return {
      bucketName: 'profileImages',
      filename: `profile_${userId}_${timestamp}`,
      metadata: {
        userId,
        mimetype: file.mimetype,
      },
      contentType: file.mimetype,
    };
  },
});

const upload = multer({ storage });

const getBucket = (bucketName = 'profileImages') => {
  return new GridFSBucket(mongoose.connection.db, { bucketName });
};

module.exports = {
  upload,
  getBucket,
};

