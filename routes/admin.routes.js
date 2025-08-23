const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const { restrict, isAdmin } = require('../middlewares/auth.middleware');

// Admin menyetujui peserta magang
router.put(
  '/peserta-magang/approve/:id',
  restrict,
  isAdmin,
  admin.approvePesertaMagang
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
