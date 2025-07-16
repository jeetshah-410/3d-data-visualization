const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const upload = require('../middleware/upload');
const router = express.Router();

router.post('/', upload.single('file'), (req, res) => {
  const filePath = req.file.path;
  const ext = filePath.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const results = [];
    let headers = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (hdrs) => {
        headers = hdrs; // Capture the CSV column names
      })
      .on('data', (row) => {
        results.push(row); // Don’t parse x/y/z yet, send raw
      })
      .on('end', () => {
        res.json({
          headers,   // e.g., ["latitude", "longitude", "depth"]
          data: results
        });
      });

  } else if (ext === 'json') {
    const raw = fs.readFileSync(filePath);
    try {
      const parsed = JSON.parse(raw);
      const headers = parsed.length > 0 ? Object.keys(parsed[0]) : [];
      res.json({ headers, data: parsed });
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON file' });
    }

  } else {
    res.status(400).json({ error: 'Unsupported file type' });
  }
});

module.exports = router;
