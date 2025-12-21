const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid file id' });
    }

    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'profileImages' });
    const _id = new ObjectId(id);

    const files = await bucket.find({ _id }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    const file = files[0];

    res.set('Content-Type', file.contentType || (file.metadata && file.metadata.mimetype) || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    const downloadStream = bucket.openDownloadStream(_id);
    downloadStream.on('error', () => {
      res.status(500).end();
    });
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Stream file error:', error);
    res.status(500).json({ success: false, message: 'Error streaming file' });
  }
});

module.exports = router;

