const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const subkoorbid = require('../controllers/subkoorbid.controller');
const bidang = require('../controllers/bidang.controller');
const peserta = require('../controllers/peserta.controller');
const ajuan = require('../controllers/ajuanMagang.controller');
const { restrict, isAdmin } = require('../middlewares/auth.middleware');
const { uploadSuratPenerimaan } = require('../middlewares/upload.middleware');

router.post('/create-admin', admin.createAdmin);

// Daftar peserta magang pending
router.get(
  '/peserta-magang/pending',
  restrict,
  isAdmin,
  admin.getPendingPesertaMagang
);

// History peserta magang (APPROVED & REJECTED)
router.get(
  '/peserta-magang/history',
  restrict,
  isAdmin,
  admin.getHistoryPesertaMagang
);

// Admin menyetujui peserta magang
router.patch(
  '/peserta-magang/:id/approve',
  restrict,
  isAdmin,
  admin.approvePesertaMagang
);

// Admin menolak peserta magang
router.patch(
  '/peserta-magang/:id/reject',
  restrict,
  isAdmin,
  admin.rejectPesertaMagang
);

// Rute untuk Admin memperbarui detail peserta
router.put(
  '/peserta-magang/:userId', // :userId adalah ID dari tabel User
  restrict,
  isAdmin,
  admin.adminUpdatePesertaProfile // Kita akan buat fungsi ini
);

// CREATE Sub Koordinator Akun
router.post(
  '/create-subkoordinator',
  restrict,
  isAdmin,
  subkoorbid.createSubKoordinator
);

// GET semua sub koordinator
router.get('/subkoordinator', restrict, isAdmin, subkoorbid.getAllSubkoorbid);

// GET sub koordinator by ID
router.get(
  '/subkoordinator/:id',
  restrict,
  isAdmin,
  subkoorbid.getSubkoorbidById
);

// DELETE sub koordinator
router.delete(
  '/subkoordinator/:id',
  restrict,
  isAdmin,
  subkoorbid.deleteSubkoorbidById
);

// Admin update profil sub koordinator berdasarkan ID
router.put(
  '/subkoordinator/:id',
  restrict,
  isAdmin,
  subkoorbid.updateProfileSubKoordinator
);

// Create Bidang Magang
router.post(
  '/bidang/create-bidang',
  restrict,
  isAdmin,
  bidang.createKuotaBidang
);

// Get All Bidang
router.get('/bidang', restrict, isAdmin, bidang.getAllKuotaBidang);

// Get Bidang By ID
router.get('/bidang/:id', restrict, isAdmin, bidang.getKuotaBidangById);

// Get All Data Magang
router.get('/data-magang', restrict, isAdmin, peserta.getAllPesertaMagang);

// Get All Data Ajuan Magang
router.get('/ajuan-magang', restrict, isAdmin, ajuan.getAllAjuanMagang);

// Memberikan Balasan Ajuan Magang
router.patch(
  '/ajuan-magang/:id/status',
  restrict,
  isAdmin,
  ajuan.updateStatusAjuan
);

// Route untuk mengambil daftar peserta yang diterima
router.get('/peserta-diterima', restrict, isAdmin, ajuan.getPesertaDiterima);

// Route untuk mengirim surat (meng-upload)
router.post(
  '/kirim-surat',
  restrict,
  isAdmin,
  uploadSuratPenerimaan,
  ajuan.kirimSuratPenerimaan
);

module.exports = router;
