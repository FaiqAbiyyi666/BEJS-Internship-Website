const express = require('express');
const router = express.Router();
const peserta = require('../controllers/peserta.controller');
const bidang = require('../controllers/bidang.controller');
const { restrict, isPesertaMagang } = require('../middlewares/auth.middleware');

router.get(
  '/profile',
  restrict,
  isPesertaMagang,
  peserta.getAuthenticatedUserProfile
);
router.get('/profile/:id', restrict, isPesertaMagang, peserta.getProfileById);
router.put('/profile', restrict, peserta.updateUserProfile);

router.get('/kuota-bidang', bidang.getAllKuotaBidang);

module.exports = router;
