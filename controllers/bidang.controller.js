const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  createKuotaBidang: async (req, res, next) => {
    try {
      const { nama, kuota } = req.body;

      // Validasi input
      if (!nama || kuota == null) {
        return res.status(400).json({
          status: false,
          message: 'Nama dan kuota wajib diisi',
          data: null,
        });
      }

      // Cek apakah bidang dengan nama yang sama sudah ada
      const existing = await prisma.kuotaBidang.findFirst({ where: { nama } });
      if (existing) {
        return res.status(409).json({
          status: false,
          message: 'Nama bidang sudah terdaftar',
          data: null,
        });
      }

      // Simpan ke database
      const bidang = await prisma.kuotaBidang.create({
        data: {
          nama,
          kuota: parseInt(kuota),
        },
      });

      return res.status(201).json({
        status: true,
        message: 'Bidang berhasil dibuat',
        data: bidang,
      });
    } catch (error) {
      next(error);
    }
  },

  updateKuotaBidang: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nama, kuota } = req.body;

      // Validasi input
      if (!nama || kuota == null) {
        return res.status(400).json({
          status: false,
          message: 'Nama dan kuota wajib diisi',
          data: null,
        });
      }

      // Cek apakah bidang dengan ID tersebut ada
      const existing = await prisma.kuotaBidang.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          status: false,
          message: 'Bidang tidak ditemukan',
          data: null,
        });
      }

      // Update bidang
      const updated = await prisma.kuotaBidang.update({
        where: { id },
        data: {
          nama,
          kuota: parseInt(kuota),
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Kuota bidang berhasil diperbarui',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  // === Get All Bidang ===
  getAllKuotaBidang: async (req, res, next) => {
    try {
      const bidang = await prisma.kuotaBidang.findMany();
      return res.status(200).json({
        status: true,
        message: 'Daftar bidang berhasil diambil',
        data: bidang,
      });
    } catch (error) {
      next(error);
    }
  },

  // === Get Bidang by ID ===
  getKuotaBidangById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const bidang = await prisma.kuotaBidang.findUnique({ where: { id } });

      if (!bidang) {
        return res.status(404).json({
          status: false,
          message: 'Bidang tidak ditemukan',
          data: null,
        });
      }

      return res.status(200).json({
        status: true,
        message: 'Detail bidang berhasil diambil',
        data: bidang,
      });
    } catch (error) {
      next(error);
    }
  },

  updateKuotaBidang: async (req, res, next) => {
    try {
      const userId = req.user.id; // dari token login
      const { kuota } = req.body;

      if (kuota == null || isNaN(kuota) || kuota < 0) {
        return res.status(400).json({
          status: false,
          message: 'Kuota harus berupa angka dan tidak boleh negatif',
          data: null,
        });
      }

      // Cari data sub koordinator dan bidangnya
      const subKoordinator = await prisma.subKoordinatorBidang.findUnique({
        where: { userId },
      });

      if (!subKoordinator) {
        return res.status(403).json({
          status: false,
          message: 'Akses ditolak. Anda bukan sub koordinator bidang.',
          data: null,
        });
      }

      const bidangId = subKoordinator.bidangId;

      // Update kuota hanya pada bidang miliknya
      const updatedBidang = await prisma.kuotaBidang.update({
        where: { id: bidangId },
        data: { kuota: parseInt(kuota) },
      });

      return res.status(200).json({
        status: true,
        message: 'Kuota magang berhasil diperbarui',
        data: updatedBidang,
      });
    } catch (error) {
      next(error);
    }
  },
};
