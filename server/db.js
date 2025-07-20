const { Pool } = require('pg');
require('dotenv').config(); // Load from .env

// Debug: Check if environment variables are loaded
console.log('DB Config:', {
  user: process.env.DB_USER || 'MISSING',
  host: process.env.DB_HOST || 'MISSING',
  database: process.env.DB_NAME || 'MISSING',
  password: process.env.DB_PASS === undefined ? 'UNDEFINED' : (process.env.DB_PASS === '' ? 'EMPTY' : '***'),
  port: process.env.DB_PORT || 'MISSING',
});


const pool = new Pool({
  user: process.env.DB_USER || 'victor',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'viz',
  password: process.env.DB_PASS || 'noobmaster',
  port: parseInt(process.env.DB_PORT) || 5432,
});

module.exports = pool;