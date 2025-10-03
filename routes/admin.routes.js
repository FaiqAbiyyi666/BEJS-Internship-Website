const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
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
router.put(
  '/peserta-magang/:id/approve',
  restrict,
  isAdmin,
  admin.approvePesertaMagang
);

// Admin menolak peserta magang
router.put(
  '/peserta-magang/:id/reject',
  restrict,
  isAdmin,
  admin.rejectPesertaMagang
);

router.post('/create-admin', admin.createAdmin);
router.post(
  '/create-subkoordinator',
  restrict,
  isAdmin,
  admin.createSubKoordinator
);
router.post(
  '/bidang/create-bidang',
  restrict,
  isAdmin,
  admin.createKuotaBidang
);

module.exports = router;
