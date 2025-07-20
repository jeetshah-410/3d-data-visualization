const express = require('express');
const path = require('path');
const upload = require('../middleware/upload'); // uses memoryStorage now
const router = express.Router();
const csvParser = require('csv-parser');
const stream = require('stream');

// @route   POST /api/upload
// @desc    Handle file upload and parse
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { originalname, mimetype, size, buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    let parsedData = [];
    const metadata = {
      columns: [],
      rows: 0,
      preview: [],
    };

    if (ext === '.csv') {
      parsedData = await parseCSV(buffer, metadata);
    } else if (ext === '.json') {
      parsedData = await parseJSON(buffer, metadata);
    } else {
      return res.status(400).json({ error: 'Only CSV and JSON files are supported' });
    }

    return res.status(200).json({
      message: 'File uploaded and parsed successfully',
      headers: metadata.columns,
      data: parsedData,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// ----------------------
// 🛠️ Helper Functions
// ----------------------

async function parseCSV(buffer, metadata) {
  return new Promise((resolve, reject) => {
    const columnsSet = new Set();
    const rows = [];
    const preview = [];

    const readable = new stream.Readable({
      read() {
        this.push(buffer);
        this.push(null); // End of stream
      },
    });

    readable
      .pipe(csvParser())
      .on('headers', (headers) => {
        console.log('CSV Headers:', headers);
      })
      .on('data', (row) => {
        console.log('CSV Row:', row); // <-- 🔍 log each row
        metadata.rows += 1;
        Object.keys(row).forEach((col) => columnsSet.add(col));
        rows.push(row);
        if (preview.length < 5) preview.push(row);
      })
      .on('end', () => {
        metadata.columns = Array.from(columnsSet);
        metadata.preview = preview;
        console.log('Parsed rows:', rows.length);
        resolve(rows);
      })
      .on('error', (err) => {
        console.error('CSV parse error:', err);
        reject(err);
      });
  });
}

async function parseJSON(buffer, metadata) {
  const jsonData = JSON.parse(buffer.toString('utf-8'));
  const rows = Array.isArray(jsonData) ? jsonData : [jsonData];
  metadata.rows = rows.length;
  metadata.columns = Object.keys(rows[0] || {});
  metadata.preview = rows.slice(0, 5);
  return rows;
}
