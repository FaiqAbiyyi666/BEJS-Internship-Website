const express = require('express');
const router = express.Router();
const peserta = require('../controllers/peserta.controller');
const { restrict, isPesertaMagang } = require('../middlewares/auth.middleware');

router.get('/profile/:id', restrict, isPesertaMagang, peserta.getProfileById);
router.put('/profile', restrict, peserta.updateUserProfile);

module.exports = router;
