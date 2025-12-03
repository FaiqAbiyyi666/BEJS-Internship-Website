const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { uploadBerkasRegistrasi } = require('../middlewares/upload.middleware'); // multer middleware untuk pasFoto
const { restrict } = require('../middlewares/auth.middleware');

// 🚀 Register peserta magang (dengan upload pas foto)
router.post('/register', uploadBerkasRegistrasi, auth.register);
// router.post('/pengajuan', uploadBerkasAjuan, auth.);
router.post('/login', auth.login);

// Rute untuk kirim email
router.post('/forgot-password', auth.sendResetPasswordEmail);
// Rute untuk reset password (menerima token dari query)
router.post('/reset-password', auth.resetPassword);

module.exports = router;
