const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const subkoorbid = require('../controllers/subkoorbid.controller');
const bidang = require('../controllers/bidang.controller');
const { restrict, isAdmin } = require('../middlewares/auth.middleware');

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

router.post('/create-admin', admin.createAdmin);

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

module.exports = router;
