const express = require('express');
const router = express.Router();
const peserta = require('../controllers/peserta.controller');
const bidang = require('../controllers/bidang.controller');
const ajuan = require('../controllers/ajuanMagang.controller');
const { restrict, isPesertaMagang } = require('../middlewares/auth.middleware');
const {
  uploadPasFoto,
  uploadBerkasAjuan,
} = require('../middlewares/upload.middleware');

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

router.post(
  '/ajuan-magang',
  restrict,
  isPesertaMagang,
  uploadBerkasAjuan,
  ajuan.createAjuanMagang
);

router.get(
  '/ajuan-magang',
  restrict,
  isPesertaMagang,
  ajuan.getAjuanMagangByPeserta
);

router.get(
  '/ajuan-magang/:id',
  restrict,
  isPesertaMagang,
  ajuan.getDetailAjuanMagang
);

module.exports = router;
