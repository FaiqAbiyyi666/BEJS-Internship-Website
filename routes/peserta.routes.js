const express = require('express');
const router = express.Router();
const peserta = require('../controllers/peserta.controller');
const bidang = require('../controllers/bidang.controller');
const { restrict, isPesertaMagang } = require('../middlewares/auth.middleware');
const { uploadPasFoto } = require('../middlewares/upload.middleware');

router.get(
  '/profile',
  restrict,
  isPesertaMagang,
  peserta.getAuthenticatedUserProfile
);
router.get('/profile/:id', restrict, isPesertaMagang, peserta.getProfileById);
router.put(
  '/profile',
  restrict,
  isPesertaMagang,
  uploadPasFoto,
  peserta.updateUserProfile
);

router.get('/kuota-bidang', bidang.getAllKuotaBidang);

module.exports = router;
