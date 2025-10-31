const multer = require('multer');
const path = require('path');
const imagekit = require('../libs/imagekit'); // Panggil konfigurasi ImageKit

// Gunakan memoryStorage untuk menahan file sementara di memori
const storage = multer.memoryStorage();

// Inisialisasi multer dengan memoryStorage
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Filter untuk gambar dan PDF (untuk berkas)
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
  limits: { fileSize: 5 * 1024 * 1024 }, // Naikkan limit ke 5MB untuk mengakomodasi PDF
});

/**
 * Middleware untuk mengunggah satu file "pas_foto" ke ImageKit.
 */
const uploadPasFoto = (req, res, next) => {
  // Gunakan middleware single dari multer untuk field 'pas_foto'
  upload.single('pasFoto')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      // Jika pas foto tidak wajib, lewati saja
      return next();
    }

    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname);
      const fileName = `pasfoto-${uniqueSuffix}${ext}`;

      // Proses upload ke ImageKit
      const result = await imagekit.upload({
        file: req.file.buffer, // Ambil file dari buffer
        fileName: fileName,
        folder: '/pas_foto/', // Folder tujuan di ImageKit
      });

      // Simpan URL hasil upload ke req.body agar bisa diakses controller
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

/**
 * Middleware untuk mengunggah banyak "berkas_ajuan_magang" ke ImageKit.
 */
const uploadBerkasAjuan = (req, res, next) => {
  const fields = [
    { name: 'proposal_magang', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
    { name: 'ktp', maxCount: 1 },
    { name: 'surat_pengantar', maxCount: 1 },
    { name: 'surat_bakesbang_sda', maxCount: 1 },
    { name: 'surat_bakesbang_prov', maxCount: 1 },
  ];

  // Gunakan middleware fields dari multer
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

      // Loop setiap field yang ada di req.files
      for (const field in req.files) {
        const file = req.files[field][0];
        const folderName = field; // Nama field akan menjadi nama folder (e.g., 'cv', 'ktp')

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const fileName = `${folderName}-${uniqueSuffix}${ext}`;

        // Buat promise untuk setiap proses upload
        const uploadPromise = imagekit
          .upload({
            file: file.buffer,
            fileName: fileName,
            folder: `/berkas_ajuan_magang/${folderName}/`, // Folder tujuan dinamis
          })
          .then((result) => {
            // Simpan URL berdasarkan field name
            uploadedUrls[folderName] = result.url;
          });

        uploadPromises.push(uploadPromise);
      }

      // Jalankan semua promise upload secara paralel
      await Promise.all(uploadPromises);

      // Simpan semua URL ke req.body
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
  // Nama field 'suratPenerimaan' harus sesuai dengan yang dikirim dari FormData frontend
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

      // Proses upload ke ImageKit
      const result = await imagekit.upload({
        file: req.file.buffer, // Ambil file dari buffer
        fileName: fileName,
        folder: '/surat_penerimaan_magang/', // <-- Folder Sesuai Permintaan
      });

      // Simpan URL dan ID file ke req.body agar bisa diakses controller
      req.body.fileUrl = result.url;
      req.body.fileId = result.fileId;

      // req.file.buffer akan otomatis diteruskan ke controller
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
  // Nama field 'file' harus sesuai dengan yang dikirim dari FormData frontend
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'File sertifikat (PDF) wajib diunggah.' });
    }

    // Validasi ganda untuk memastikan ini PDF
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
