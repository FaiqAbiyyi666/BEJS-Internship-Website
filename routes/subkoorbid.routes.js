const express = require('express');
const router = express.Router();
const subkoorbid = require('../controllers/subkoorbid.controller');
const {
  restrict,
  isSubKoordinatorMagang,
} = require('../middlewares/auth.middleware');

// Admin update profil sub koordinator berdasarkan ID
router.put(
  '/profile',
  restrict,
  isSubKoordinatorMagang,
  subkoorbid.updateProfileSubKoordinator
);
