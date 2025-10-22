const express = require('express');
const router = express.Router();
const bidangController = require('../controllers/bidang.controller');
const { restrict, isAdmin } = require('../middlewares/auth.middleware'); // Sesuaikan path

// Semua rute di sini hanya untuk admin
router.use(restrict, isAdmin);

// GET /api/admin/bidang -> Ambil semua bidang (dengan peserta aktif)
router.get('/', bidangController.getAllKuotaBidang);

// POST /api/admin/bidang -> Buat bidang baru
router.post('/', bidangController.createKuotaBidang);

// PATCH /api/admin/bidang/:id -> Update bidang
router.patch('/:id', bidangController.updateKuotaBidang);

// DELETE /api/admin/bidang/:id -> Hapus bidang
router.delete('/:id', bidangController.deleteKuotaBidang);

module.exports = router;
