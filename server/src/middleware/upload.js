const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create the /uploads folder if it doesn't exist
const uploadPath = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Export configured multer instance
const upload = multer({ storage });

module.exports = upload;
