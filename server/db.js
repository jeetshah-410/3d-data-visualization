const { Pool } = require('pg');
require('dotenv').config(); // Load from .env

// Debug: Check if environment variables are loaded
console.log('DB Config:', {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS ? '***' : 'UNDEFINED',
  port: process.env.DB_PORT,
});

const pool = new Pool({
  user: process.env.DB_USER || 'victor',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'viz',
  password: process.env.DB_PASS || 'noobmaster',
  port: parseInt(process.env.DB_PORT) || 5432,
});

module.exports = pool;