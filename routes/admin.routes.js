const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const subkoorbid = require('../controllers/subkoorbid.controller');
const bidang = require('../controllers/bidang.controller');
const peserta = require('../controllers/peserta.controller');
const ajuan = require('../controllers/ajuanMagang.controller');
const kritikSaran = require('../controllers/kritikSaran.controller');
const ulasan = require('../controllers/ulasanMagang.controller');
const sertifikat = require('../controllers/sertifikat.controller');
const logbook = require('../controllers/logbook.controller');
const laporanAkhir = require('../controllers/laporanAkhir.controller');
const dashboard = require('../controllers/dashboard.controller');
const {
  restrict,
  isAdmin,
  isAdminOrSubKoordinator,
} = require('../middlewares/auth.middleware');
const {
  uploadSuratPenerimaan,
  uploadSertifikat,
} = require('../middlewares/upload.middleware');

router.post('/create-admin', admin.createAdmin);
router.get(
  '/profile',
  restrict,
  isAdminOrSubKoordinator,
  admin.getAdminProfile
);
router.post('/change-password', restrict, isAdmin, admin.changeAdminPassword);

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

// Untuk List Bidang Magang
router.get('/bidang/list', restrict, isAdmin, bidang.getAllBidang);

// Get All Bidang
router.get('/bidang', restrict, isAdmin, bidang.getAllKuotaBidang);

// Get Bidang By ID
router.get('/bidang/:id', restrict, isAdmin, bidang.getKuotaBidangById);

// Get All Data Magang
router.get(
  '/data-magang',
  restrict,
  isAdminOrSubKoordinator,
  peserta.getAllPesertaMagang
);

// Get All Data Ajuan Magang
router.get(
  '/ajuan-magang',
  restrict,
  isAdminOrSubKoordinator,
  ajuan.getAllAjuanMagang
);

// Memberikan Balasan Ajuan Magang
router.patch(
  '/ajuan-magang/:id/status',
  restrict,
  isAdminOrSubKoordinator,
  ajuan.updateStatusAjuan
);

// Route untuk mengambil daftar peserta yang diterima
router.get(
  '/peserta-diterima',
  restrict,
  isAdminOrSubKoordinator,
  ajuan.getPesertaDiterima
);

// Route untuk mengirim surat (meng-upload)
router.post(
  '/kirim-surat',
  restrict,
  isAdminOrSubKoordinator,
  uploadSuratPenerimaan,
  ajuan.kirimSuratPenerimaan
);

// Route baru untuk mengambil RIWAYAT surat yang terkirim
router.get(
  '/riwayat-surat-penerimaan',
  restrict,
  isAdminOrSubKoordinator,
  ajuan.getAllRiwayatSurat
);

// URL akan menjadi /api/admin/kritik-saran
router.get(
  '/kritik-saran',
  restrict,
  isAdminOrSubKoordinator,
  kritikSaran.getAllKritikSaran
);

// Endpoint untuk admin mengambil semua ulasan (memerlukan login admin)
router.get(
  '/ulasan-magang',
  restrict,
  isAdminOrSubKoordinator,
  ulasan.getAllUlasanForAdmin
);

// Endpoint untuk admin mengirim sertifikat
router.post(
  '/kirim-sertifikat',
  restrict,
  isAdminOrSubKoordinator,
  uploadSertifikat,
  sertifikat.kirimSertifikat
);

router.get(
  '/sertifikat/history',
  restrict,
  isAdminOrSubKoordinator,
  sertifikat.getHistorySertifikat
);

router.get(
  '/ajuan-for-sertifikat',
  restrict,
  isAdminOrSubKoordinator,
  sertifikat.getAjuanForSertifikat
);

router.get(
  '/logbook/all',
  restrict,
  isAdminOrSubKoordinator,
  logbook.getAllLogbooks
);

router.get(
  '/logbook/:id',
  restrict,
  isAdminOrSubKoordinator,
  logbook.getLogbookById
);

router.get(
  '/laporan-akhir/pending',
  restrict,
  isAdminOrSubKoordinator,
  laporanAkhir.getLaporanMasuk
);

router.get(
  '/laporan-akhir/history',
  restrict,
  isAdminOrSubKoordinator,
  laporanAkhir.getLaporanRiwayat
);

router.patch(
  '/laporan-akhir/respond/:id',
  restrict,
  isAdminOrSubKoordinator,
  laporanAkhir.responseLaporan
);

router.get(
  '/dashboard-admin',
  restrict,
  isAdminOrSubKoordinator,
  dashboard.getDashboardStats
);

module.exports = router;
