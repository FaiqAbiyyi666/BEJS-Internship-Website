const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const subkoorbid = require('../controllers/subkoorbid.controller');
const bidang = require('../controllers/bidang.controller');
const peserta = require('../controllers/peserta.controller');
const ajuan = require('../controllers/ajuanMagang.controller');
const {
  restrict,
  isAdminOrSubKoordinator,
  isPesertaMagang,
} = require('../middlewares/auth.middleware');




module.exports = router;
