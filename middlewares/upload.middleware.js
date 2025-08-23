const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Pastikan folder uploads/pasfoto ada
const folderPath = path.join(__dirname, '../uploads/pasfoto');
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true });
}

// Konfigurasi penyimpanan
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'pasfoto-' + uniqueSuffix + ext);
  },
});

// Filter jenis file (hanya JPG/JPEG/PNG)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (jpg/jpeg/png) yang diperbolehkan'));
  }
};

// Maksimum ukuran file: 2MB
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

module.exports = upload;
