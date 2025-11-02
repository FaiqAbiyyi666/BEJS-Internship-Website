const multer = require('multer');
const path = require('path');
const imagekit = require('../libs/imagekit');

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    if (
      allowedTypes.test(ext) &&
      (mime.startsWith('image/') || mime === 'application/pdf')
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Jenis file tidak valid. Hanya JPG, PNG, atau PDF yang diperbolehkan.'
        )
      );
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadPasFoto = (req, res, next) => {
  upload.single('pasFoto')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return next();
    }

    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname);
      const fileName = `pasfoto-${uniqueSuffix}${ext}`;

      const result = await imagekit.upload({
        file: req.file.buffer,
        fileName: fileName,
        folder: '/pas_foto/',
      });

      req.body.pasFotoUrl = result.url;
      next();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: 'Gagal mengunggah pas foto ke ImageKit.' });
    }
  });
};

const uploadBerkasAjuan = (req, res, next) => {
  const fields = [
    { name: 'proposal_magang', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
    { name: 'ktp', maxCount: 1 },
    { name: 'surat_pengantar', maxCount: 1 },
    { name: 'surat_bakesbang_sda', maxCount: 1 },
    { name: 'surat_bakesbang_prov', maxCount: 1 },
  ];

  upload.fields(fields)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json({ message: 'Tidak ada file berkas yang diunggah.' });
    }

    try {
      const uploadPromises = [];
      const uploadedUrls = {};

      for (const field in req.files) {
        const file = req.files[field][0];
        const folderName = field;

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const fileName = `${folderName}-${uniqueSuffix}${ext}`;

        const uploadPromise = imagekit
          .upload({
            file: file.buffer,
            fileName: fileName,
            folder: `/berkas_ajuan_magang/${folderName}/`,
          })
          .then((result) => {
            uploadedUrls[folderName] = result.url;
          });

        uploadPromises.push(uploadPromise);
      }

      await Promise.all(uploadPromises);

      req.body.berkas_urls = uploadedUrls;
      next();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: 'Gagal mengunggah berkas ke ImageKit.' });
    }
  });
};

const uploadSuratPenerimaan = (req, res, next) => {
  upload.single('suratPenerimaan')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'File surat penerimaan (PDF) wajib diunggah.' });
    }

    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname);
      const fileName = `suratpenerimaan-${uniqueSuffix}${ext}`;

      const result = await imagekit.upload({
        file: req.file.buffer,
        fileName: fileName,
        folder: '/surat_penerimaan_magang/',
      });

      req.body.fileUrl = result.url;
      req.body.fileId = result.fileId;

      next();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: 'Gagal mengunggah surat penerimaan ke ImageKit.' });
    }
  });
};

const uploadSertifikat = (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'File sertifikat (PDF) wajib diunggah.' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        message:
          'Jenis file tidak valid. Hanya PDF yang diperbolehkan untuk sertifikat.',
      });
    }

    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname);
      const fileName = `sertifikat-${uniqueSuffix}${ext}`;

      const result = await imagekit.upload({
        file: req.file.buffer,
        fileName: fileName,
        folder: '/sertifikat/',
      });

      req.body.fileUrl = result.url;

      next();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: 'Gagal mengunggah sertifikat ke ImageKit.' });
    }
  });
};

const uploadLaporanAkhir = (req, res, next) => {
  upload.single('fileLaporan')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ msg: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ msg: 'Tidak ada file yang diunggah.' });
    }

    const { id: userId } = req.user;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    try {
      const ext = path.extname(req.file.originalname);
      const fileName = `laporan_akhir_${userId}_${Date.now()}${ext}`;

      const response = await imagekit.upload({
        file: req.file.buffer,
        fileName: fileName,
        folder: '/laporan_akhir/',
        useUniqueFileName: false,
      });

      req.imagekit_file_info = {
        fileUrl: response.url,
        fileId: response.fileId,
      };

      next();
    } catch (error) {
      console.error('ImageKit Upload Error:', error);
      return res
        .status(500)
        .json({ msg: 'Gagal mengunggah file', error: error.message });
    }
  });
};

module.exports = {
  uploadPasFoto,
  uploadBerkasAjuan,
  uploadSuratPenerimaan,
  uploadSertifikat,
  uploadLaporanAkhir,
};
