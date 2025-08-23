const express = require('express');
const router = express.Router();
const peserta = require('../controllers/peserta.controller');
const { restrict } = require('../middlewares/auth.middleware');

router.put('/profile', restrict, peserta.updateUserProfile);

module.exports = router;
