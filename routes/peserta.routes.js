const express = require('express');
const router = express.Router();
const peserta = require('../controllers/peserta.controller');
const bidang = require('../controllers/bidang.controller');
const ajuan = require('../controllers/ajuanMagang.controller');
const kritikSaran = require('../controllers/kritikSaran.controller');
const ulasan = require('../controllers/ulasanMagang.controller');
const sertifikat = require('../controllers/sertifikat.controller');
const logbook = require('../controllers/logbook.controller');
const laporanAkhir = require('../controllers/laporanAkhir.controller');
const { restrict, isPesertaMagang } = require('../middlewares/auth.middleware');
const {
  uploadPasFoto,
  uploadBerkasAjuan,
  uploadLaporanAkhir,
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
router.get('/ajuan-magang', ajuan.getPublicAjuanList);
router.post('/kritik-saran', kritikSaran.createKritikSaran);
router.get('/ulasan-magang', ulasan.getPublicUlasan);
router.get('/ulasan-magang/all', ulasan.getAllUlasanForPublicPage);

router.post(
  '/ajuan-magang',
  restrict,
  isPesertaMagang,
  uploadBerkasAjuan,
  ajuan.createAjuanMagang
);

router.get(
  '/ajuan-magang-saya',
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

router.post('/ulasan-magang', restrict, isPesertaMagang, ulasan.createUlasan);

router.get('/sertifikat', restrict, isPesertaMagang, sertifikat.getSertifikat);

router.get('/logbook', restrict, isPesertaMagang, logbook.getLogbookData);

router.post(
  '/logbook',
  restrict,
  isPesertaMagang,
  logbook.createOrUpdateLogbook
);

router.post(
  '/laporan-akhir',
  restrict,
  isPesertaMagang,
  uploadLaporanAkhir,
  laporanAkhir.submitLaporan
);

router.get(
  '/laporan-akhir/history',
  restrict,
  isPesertaMagang,
  laporanAkhir.getMyLaporanHistory
);

module.exports = router;
