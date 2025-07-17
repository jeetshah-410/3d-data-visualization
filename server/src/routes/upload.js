const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const upload = require('../middleware/upload');
const pool = require('../../db'); // PostgreSQL connection

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
          const allRows = []; // Store all data for frontend
          
          if (!fs.existsSync(filePath)) {
            return reject(new Error(`File not found at path: ${filePath}`));
          }
          
          fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => {
              rowCount++;
              Object.keys(row).forEach((col) => columnsSet.add(col));
              allRows.push(row); // Store all rows
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

      // Save to database
      await pool.query(
        `INSERT INTO datasets (filename, originalname, size, mimetype, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [filename, originalname, size, mimetype, JSON.stringify(metadata)]
      );

      // Return data in the format expected by frontend
      res.json({ 
        success: true, 
        message: 'CSV uploaded and saved to DB.',
        headers: metadata.columns,
        data: parsedData
      });

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

      // Save to database
      await pool.query(
        `INSERT INTO datasets (filename, originalname, size, mimetype, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [filename, originalname, size, mimetype, JSON.stringify(metadata)]
      );

      // Return data in the format expected by frontend
      res.json({ 
        success: true, 
        message: 'JSON uploaded and saved to DB.',
        headers: metadata.columns,
        data: parsedData
      });

    } else {
      res.status(400).json({ error: 'Unsupported file format.' });
    }
  } catch (err) {
    console.error('Upload Error:', err.message, err.stack);
    res.status(500).json({ error: 'File upload or DB error.', details: err.message });
  }
});

module.exports = router;