const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const upload = require('../middleware/upload');
const pool = require('../../db'); // PostgreSQL connection
const cors = require('cors');

// Enhanced CORS configuration for upload routes
const uploadCorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, or Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'https://3d-data-visualization.vercel.app/', // Replace with your actual Vercel URL
      /^https:\/\/.*\.vercel\.app$/, // Allow any Vercel subdomain
      /^https:\/\/.*\.railway\.app$/ // Allow Railway domains for testing
    ];
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return pattern === origin;
      }
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS rejected origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

// Apply CORS to all routes in this router
router.use(cors(uploadCorsOptions));

// Health check endpoint for this route
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Upload service is running',
    timestamp: new Date().toISOString()
  });
});

// Enhanced file upload endpoint with better error handling
router.post('/', upload.single('file'), async (req, res) => {
  // Validate file upload
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded', 
      details: 'Please select a file to upload' 
    });
  }

  const { originalname, mimetype, size, filename, path: filePath } = req.file;
  const ext = path.extname(originalname).toLowerCase();

  // Validate file type
  if (!['.csv', '.json'].includes(ext)) {
    // Clean up uploaded file if invalid type
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up invalid file:', cleanupError);
    }
    return res.status(400).json({ 
      error: 'Unsupported file format', 
      details: 'Only CSV and JSON files are supported' 
    });
  }

  // Validate file size (e.g., 50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (size > maxSize) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up large file:', cleanupError);
    }
    return res.status(400).json({ 
      error: 'File too large', 
      details: `File size must be less than ${maxSize / (1024 * 1024)}MB` 
    });
  }

  const metadata = {
    columns: [],
    rows: 0,
    preview: [],
  };

  console.log('Processing uploaded file:', {
    originalname,
    size: `${(size / 1024).toFixed(2)} KB`,
    mimetype,
    path: filePath
  });

  try {
    let parsedData = [];

    if (ext === '.csv') {
      const parseCSV = () =>
        new Promise((resolve, reject) => {
          const columnsSet = new Set();
          let rowCount = 0;
          const previewRows = [];
          const allRows = [];
          let hasError = false;

          if (!fs.existsSync(filePath)) {
            return reject(new Error(`File not found at path: ${filePath}`));
          }

          const stream = fs.createReadStream(filePath)
            .pipe(csvParser({
              skipEmptyLines: true,
              trim: true,
              headers: true
            }))
            .on('data', (row) => {
              try {
                rowCount++;
                
                // Clean up column names (trim whitespace)
                const cleanRow = {};
                Object.keys(row).forEach((key) => {
                  const cleanKey = key.trim();
                  columnsSet.add(cleanKey);
                  cleanRow[cleanKey] = row[key];
                });
                
                allRows.push(cleanRow);
                if (previewRows.length < 5) previewRows.push(cleanRow);
                
                // Prevent memory issues with very large files
                if (rowCount > 100000) { // 100k row limit
                  hasError = true;
                  stream.destroy();
                  reject(new Error('File too large. Maximum 100,000 rows allowed.'));
                }
              } catch (rowError) {
                console.error('Error processing CSV row:', rowError);
                hasError = true;
                stream.destroy();
                reject(rowError);
              }
            })
            .on('end', () => {
              if (!hasError) {
                metadata.columns = [...columnsSet];
                metadata.rows = rowCount;
                metadata.preview = previewRows;
                parsedData = allRows;
                console.log(`CSV parsed successfully: ${rowCount} rows, ${metadata.columns.length} columns`);
                resolve();
              }
            })
            .on('error', (error) => {
              console.error('CSV parsing error:', error);
              reject(new Error(`Failed to parse CSV: ${error.message}`));
            });
        });

      await parseCSV();

    } else if (ext === '.json') {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
      }

      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        
        // Validate JSON size in memory
        if (raw.length > 10 * 1024 * 1024) { // 10MB text limit
          throw new Error('JSON file too large to process');
        }
        
        const jsonData = JSON.parse(raw);
        const rows = Array.isArray(jsonData) ? jsonData : [jsonData];

        // Validate row count
        if (rows.length > 100000) {
          throw new Error('JSON file contains too many records. Maximum 100,000 records allowed.');
        }

        metadata.rows = rows.length;
        
        // Get columns from first non-null object
        let columnsExtracted = false;
        for (const row of rows) {
          if (row && typeof row === 'object') {
            metadata.columns = Object.keys(row);
            columnsExtracted = true;
            break;
          }
        }
        
        if (!columnsExtracted) {
          throw new Error('No valid data objects found in JSON file');
        }

        metadata.preview = rows.slice(0, 5);
        parsedData = rows;

        console.log(`JSON parsed successfully: ${rows.length} rows, ${metadata.columns.length} columns`);

      } catch (jsonError) {
        if (jsonError.name === 'SyntaxError') {
          throw new Error('Invalid JSON format. Please check your file syntax.');
        }
        throw jsonError;
      }
    }

    // Validate parsed data
    if (!parsedData || parsedData.length === 0) {
      throw new Error('No data found in file or file is empty');
    }

    if (!metadata.columns || metadata.columns.length === 0) {
      throw new Error('No columns detected in file');
    }

    // Save to database with error handling
    try {
      await pool.query(
        `INSERT INTO datasets (filename, originalname, size, mimetype, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [filename, originalname, size, mimetype, JSON.stringify(metadata)]
      );
      
      console.log('File metadata saved to database successfully');
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Don't fail the entire request if DB save fails, but log it
      console.warn('File processed successfully but metadata not saved to database');
    }

    // Return success response
    res.json({
      success: true,
      message: `${ext.toUpperCase().slice(1)} file uploaded and processed successfully.`,
      headers: metadata.columns,
      data: parsedData,
      metadata: {
        rowCount: metadata.rows,
        columnCount: metadata.columns.length,
        fileSize: size,
        fileName: originalname
      }
    });

  } catch (err) {
    console.error('Upload processing error:', {
      message: err.message,
      stack: err.stack,
      file: originalname
    });

    // Clean up file on error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up failed upload file');
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }

    res.status(500).json({ 
      error: 'File processing failed', 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced endpoint to get parsed data for a specific file
router.get('/file/:filename', async (req, res) => {
  const { filename } = req.params;
  
  // Validate filename parameter
  if (!filename || filename.trim() === '') {
    return res.status(400).json({ 
      error: 'Invalid filename parameter' 
    });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM datasets WHERE filename = $1', 
      [filename.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'File not found in database',
        filename: filename 
      });
    }

    const fileRecord = result.rows[0];
    const filePath = path.join(__dirname, '../../uploads', fileRecord.filename);
    const ext = path.extname(fileRecord.originalname).toLowerCase();

    if (!fs.existsSync(filePath)) {
      console.error('File missing from filesystem:', filePath);
      return res.status(404).json({ 
        error: 'File not found on server',
        details: 'File may have been deleted or moved' 
      });
    }

    // Parse metadata safely
    let metadata;
    try {
      if (typeof fileRecord.metadata === 'string') {
        metadata = JSON.parse(fileRecord.metadata);
      } else {
        metadata = fileRecord.metadata || { columns: [], rows: 0, preview: [] };
      }
    } catch (parseError) {
      console.error('Error parsing metadata:', parseError);
      metadata = { columns: [], rows: 0, preview: [] };
    }

    let parsedData = [];

    if (ext === '.csv') {
      const parseCSV = () =>
        new Promise((resolve, reject) => {
          const allRows = [];
          let rowCount = 0;

          fs.createReadStream(filePath)
            .pipe(csvParser({
              skipEmptyLines: true,
              trim: true,
              headers: true
            }))
            .on('data', (row) => {
              rowCount++;
              
              // Clean up column names
              const cleanRow = {};
              Object.keys(row).forEach((key) => {
                const cleanKey = key.trim();
                cleanRow[cleanKey] = row[key];
              });
              
              allRows.push(cleanRow);
              
              // Prevent memory issues
              if (rowCount > 100000) {
                reject(new Error('File too large to load completely'));
              }
            })
            .on('end', () => {
              parsedData = allRows;
              console.log(`File ${filename} loaded: ${rowCount} rows`);
              resolve();
            })
            .on('error', (error) => {
              console.error('Error reading CSV file:', error);
              reject(new Error(`Failed to read CSV file: ${error.message}`));
            });
        });

      await parseCSV();

    } else if (ext === '.json') {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(raw);
        parsedData = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        if (parsedData.length > 100000) {
          return res.status(400).json({
            error: 'File too large to load completely',
            details: 'File contains more than 100,000 records'
          });
        }
        
        console.log(`File ${filename} loaded: ${parsedData.length} rows`);
      } catch (jsonError) {
        console.error('Error reading JSON file:', jsonError);
        throw new Error(`Failed to read JSON file: ${jsonError.message}`);
      }

    } else {
      return res.status(400).json({ 
        error: 'Unsupported file format',
        supportedFormats: ['csv', 'json'] 
      });
    }

    console.log('File data loaded successfully:', {
      filename: fileRecord.originalname,
      columns: metadata.columns?.length || 0,
      rows: parsedData.length
    });

    res.json({
      success: true,
      headers: metadata.columns || [],
      data: parsedData,
      metadata: {
        originalName: fileRecord.originalname,
        size: fileRecord.size,
        rowCount: parsedData.length,
        columnCount: metadata.columns?.length || 0,
        uploadDate: fileRecord.created_at
      }
    });

  } catch (err) {
    console.error('Error fetching file data:', {
      filename,
      message: err.message,
      stack: err.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch file data',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced endpoint to get list of uploaded files
router.get('/files', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Validate pagination parameters
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 files per request
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    const result = await pool.query(
      `SELECT filename, originalname, size, mimetype, metadata, created_at 
       FROM datasets 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limitNum, offsetNum]
    );

    // Get total count for pagination
    const countResult = await pool.query('SELECT COUNT(*) as total FROM datasets');
    const totalFiles = parseInt(countResult.rows[0].total);

    // Parse metadata for each file safely
    const filesWithParsedMetadata = result.rows.map(file => {
      let metadata;
      try {
        if (typeof file.metadata === 'string') {
          metadata = JSON.parse(file.metadata);
        } else {
          metadata = file.metadata || { columns: [], rows: 0, preview: [] };
        }
      } catch (parseError) {
        console.error('Error parsing metadata for file:', file.filename, parseError);
        metadata = { columns: [], rows: 0, preview: [] };
      }

      return {
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        metadata: metadata,
        uploadDate: file.created_at,
        formattedSize: `${(file.size / 1024).toFixed(1)} KB`
      };
    });

    console.log(`Retrieved ${filesWithParsedMetadata.length} files from database`);

    res.json({ 
      success: true, 
      files: filesWithParsedMetadata,
      pagination: {
        total: totalFiles,
        limit: limitNum,
        offset: offsetNum,
        hasNext: offsetNum + limitNum < totalFiles,
        hasPrevious: offsetNum > 0
      }
    });

  } catch (err) {
    console.error('Error fetching files list:', {
      message: err.message,
      stack: err.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch files list',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete file endpoint (useful for cleanup)
router.delete('/file/:filename', async (req, res) => {
  const { filename } = req.params;
  
  if (!filename || filename.trim() === '') {
    return res.status(400).json({ 
      error: 'Invalid filename parameter' 
    });
  }

  try {
    // Check if file exists in database
    const result = await pool.query(
      'SELECT * FROM datasets WHERE filename = $1', 
      [filename.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'File not found in database' 
      });
    }

    const fileRecord = result.rows[0];
    const filePath = path.join(__dirname, '../../uploads', fileRecord.filename);

    // Delete from database
    await pool.query('DELETE FROM datasets WHERE filename = $1', [filename.trim()]);

    // Delete physical file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Physical file deleted:', filePath);
      }
    } catch (fsError) {
      console.error('Error deleting physical file:', fsError);
      // Don't fail the request if physical file deletion fails
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
      filename: fileRecord.originalname
    });

  } catch (err) {
    console.error('Error deleting file:', {
      filename,
      message: err.message
    });
    
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: err.message 
    });
  }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Upload router error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  if (error.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS error',
      details: 'Origin not allowed'
    });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      details: error.message
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;