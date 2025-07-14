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
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Convert string values to floats for x/y/z
        results.push({
          x: parseFloat(data.x),
          y: parseFloat(data.y),
          z: parseFloat(data.z),
        });
      })
      .on('end', () => {
        res.json({ data: results });
      });
  } else if (ext === 'json') {
    const raw = fs.readFileSync(filePath);
    try {
      const parsed = JSON.parse(raw);
      res.json({ data: parsed });
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON file' });
    }
  } else {
    res.status(400).json({ error: 'Unsupported file type' });
  }
});

module.exports = router;
