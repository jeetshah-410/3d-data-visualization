const express = require('express');
const upload = require('./middleware/upload'); // your multer config
const csv = require('csv-parser');

const fs = require('fs');
const router = express.Router();

router.post('/upload', upload.single('file'), (req, res) => {
  const filePath = req.file.path;
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.unlinkSync(filePath); // Delete after use (IMPORTANT on Railway)

      const columns = Object.keys(results[0] || {});
      res.json({
        message: 'Upload successful',
        metadata: {
          columns,
          rows: results.length,
          preview: results.slice(0, 5),
        }
      });
    });
});
