const express = require('express');
const router = express.Router();

// Import semua rute dari auth
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const bidangRoutes = require('./bidang.routes');
const pesertaRoutes = require('./peserta.routes');

// Gunakan prefix untuk auth
router.use('/api/auth', authRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/admin/bidang', bidangRoutes);
router.use('/api/peserta', pesertaRoutes);

// Route dasar
router.get('/', (req, res) => {
  res.json({
    status: true,
    message: 'Welcome to the Diskominfo Internship API 🚀',
    data: null,
  });
});

module.exports = router;
