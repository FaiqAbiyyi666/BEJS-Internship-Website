const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const upload = require('../middlewares/upload.middleware'); // multer middleware untuk pasFoto
const { restrict } = require('../middlewares/auth.middleware');

// 🚀 Register peserta magang (dengan upload pas foto)
router.post('/register', upload.single('pasFoto'), auth.register);
router.post('/login', auth.login);

module.exports = router;
