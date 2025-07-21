const express = require('express');
const cors = require('cors');
const path = require('path');
const uploadRoutes = require('./src/routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/upload', uploadRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});