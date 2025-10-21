const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const {
  uploadPasFoto,
  uploadBerkasAjuan,
} = require('../middlewares/upload.middleware'); // multer middleware untuk pasFoto
const { restrict } = require('../middlewares/auth.middleware');

// 🚀 Register peserta magang (dengan upload pas foto)
router.post('/register', uploadPasFoto, auth.register);
// router.post('/pengajuan', uploadBerkasAjuan, auth.);
router.post('/login', auth.login);

module.exports = router;
