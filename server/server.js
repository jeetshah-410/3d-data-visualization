const express = require('express');
const cors = require('cors');
const path = require('path');
const uploadRoutes = require('./src/routes/upload');
const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:3000', // For local development
    'https://3d-data-visualization.vercel.app/', // Replace with your actual Vercel URL
    'https://*.vercel.app' // Allow all Vercel subdomains (optional)
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});