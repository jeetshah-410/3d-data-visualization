const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const upload = require('../middleware/upload');
const pool = require('../../db'); // PostgreSQL connection

// Optional Redis
let redis = null;
const useRedis = process.env.REDIS_ENABLED === 'true';
if (useRedis) {
  redis = require('../redisClient');
  console.log('✅ Redis is enabled');
} else {
  console.log('⚠️ Redis is disabled');
}

router.post('/', upload.single('file'), async (req, res) => {
  const { originalname, mimetype, size, filename, path: filePath } = req.file;
  const ext = path.extname(originalname).toLowerCase();
  const metadata = {
    columns: [],
    rows: 0,
    preview: [],
  };

  console.log('Uploaded file path:', filePath);

  try {
    let parsedData = [];

    if (ext === '.csv') {
      const parseCSV = () =>
        new Promise((resolve, reject) => {
          const columnsSet = new Set();
          let rowCount = 0;
          const previewRows = [];
          const allRows = [];

          if (!fs.existsSync(filePath)) {
            return reject(new Error(`File not found at path: ${filePath}`));
          }

          fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => {
              rowCount++;
              Object.keys(row).forEach((col) => columnsSet.add(col));
              allRows.push(row);
              if (previewRows.length < 5) previewRows.push(row);
            })
            .on('end', () => {
              metadata.columns = [...columnsSet];
              metadata.rows = rowCount;
              metadata.preview = previewRows;
              parsedData = allRows;
              resolve();
            })
            .on('error', reject);
        });

      await parseCSV();
    } else if (ext === '.json') {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(raw);
      const rows = Array.isArray(jsonData) ? jsonData : [jsonData];

      metadata.rows = rows.length;
      metadata.columns = Object.keys(rows[0] || {});
      metadata.preview = rows.slice(0, 5);
      parsedData = rows;
    } else {
      return res.status(400).json({ error: 'Unsupported file format.' });
    }

    await pool.query(
      `INSERT INTO datasets (filename, originalname, size, mimetype, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [filename, originalname, size, mimetype, JSON.stringify(metadata)]
    );

    res.json({
      success: true,
      message: 'File uploaded and saved to DB.',
      headers: metadata.columns,
      data: parsedData,
    });
  } catch (err) {
    console.error('Upload Error:', err.message);
    res.status(500).json({ error: 'File upload or DB error.', details: err.message });
  }
});

router.get('/file/:filename', async (req, res) => {
  const { filename } = req.params;

  try {
    const cacheKey = `fileData:${filename}`;
    if (useRedis) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log('Cache hit for', filename);
        return res.json(JSON.parse(cachedData));
      }
      console.log('Cache miss for', filename);
    }

    const result = await pool.query('SELECT * FROM datasets WHERE filename = $1', [filename]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const fileRecord = result.rows[0];
    const filePath = path.join(__dirname, '../../uploads', fileRecord.filename);
    const ext = path.extname(fileRecord.originalname).toLowerCase();

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server.' });
    }

    let metadata;
    if (typeof fileRecord.metadata === 'string') {
      try {
        metadata = JSON.parse(fileRecord.metadata);
      } catch {
        metadata = { columns: [], rows: 0, preview: [] };
      }
    } else {
      metadata = fileRecord.metadata;
    }

    let parsedData = [];
    if (ext === '.csv') {
      const parseCSV = () =>
        new Promise((resolve, reject) => {
          const allRows = [];
          fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => allRows.push(row))
            .on('end', () => {
              parsedData = allRows;
              resolve();
            })
            .on('error', reject);
        });
      await parseCSV();
    } else if (ext === '.json') {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(raw);
      parsedData = Array.isArray(jsonData) ? jsonData : [jsonData];
    } else {
      return res.status(400).json({ error: 'Unsupported file format.' });
    }

    const responseData = {
      success: true,
      headers: metadata.columns,
      data: parsedData,
    };

    if (useRedis) {
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 3600);
    }

    res.json(responseData);
  } catch (err) {
    console.error('Error fetching file data:', err.message);
    res.status(500).json({ error: 'Failed to fetch file data.' });
  }
});

router.get('/files', async (req, res) => {
  try {
    const cacheKey = 'filesList';
    if (useRedis) {
      const cachedFiles = await redis.get(cacheKey);
      if (cachedFiles) {
        console.log('Cache hit for files list');
        return res.json(JSON.parse(cachedFiles));
      }
    }

    const result = await pool.query('SELECT filename, originalname, size, mimetype, metadata FROM datasets ORDER BY id DESC');
    const filesWithParsedMetadata = result.rows.map(file => {
      let metadata;
      if (typeof file.metadata === 'string') {
        try {
          metadata = JSON.parse(file.metadata);
        } catch {
          metadata = { columns: [], rows: 0, preview: [] };
        }
      } else {
        metadata = file.metadata;
      }
      return { ...file, metadata };
    });

    const responseData = { success: true, files: filesWithParsedMetadata };

    if (useRedis) {
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 3600);
    }

    res.json(responseData);
  } catch (err) {
    console.error('Error fetching files:', err.message);
    res.status(500).json({ error: 'Failed to fetch files.' });
  }
});

module.exports = router;
