const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  // === Get All Bidang (Disesuaikan untuk menghitung peserta) ===
  getAllKuotaBidang: async (req, res, next) => {
    try {
      const bidangWithCount = await prisma.kuotaBidang.findMany({
        // Gunakan 'include' untuk menghitung relasi
        include: {
          _count: {
            select: {
              // Hitung jumlah PesertaMagang yang terkait
              PesertaMagang: {
                // Hanya yang statusnya APPROVED
                where: { status: 'APPROVED' },
              },
            },
          },
        },
        orderBy: {
          nama: 'asc', // Urutkan berdasarkan nama
        },
      });

      // Ubah format data agar sesuai dengan ekspektasi front-end
      const data = bidangWithCount.map((bidang) => ({
        id: bidang.id,
        nama: bidang.nama,
        kuota: bidang.kuota,
        // Hasil perhitungan ada di _count.PesertaMagang
        pesertaAktif: bidang._count.PesertaMagang,
      }));

      return res.status(200).json({
        status: true,
        message: 'Daftar bidang berhasil diambil',
        data: data,
      });
    } catch (error) {
      next(error);
    }
  },

  // === Get Bidang by ID (Disesuaikan untuk menghitung peserta) ===
  getKuotaBidangById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const bidang = await prisma.kuotaBidang.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              PesertaMagang: {
                where: { status: 'APPROVED' },
              },
            },
          },
        },
      });

      if (!bidang) {
        return res.status(404).json({
          status: false,
          message: 'Bidang tidak ditemukan',
          data: null,
        });
      }

      // Ubah format data agar sesuai dengan ekspektasi front-end
      const data = {
        id: bidang.id,
        nama: bidang.nama,
        kuota: bidang.kuota,
        pesertaAktif: bidang._count.PesertaMagang,
      };

      return res.status(200).json({
        status: true,
        message: 'Detail bidang berhasil diambil',
        data: data,
      });
    } catch (error) {
      next(error);
    }
  },

  // === Create New Bidang (Validasi disempurnakan) ===
  createKuotaBidang: async (req, res, next) => {
    try {
      const { nama, kuota } = req.body;

      if (!nama || kuota == null) {
        return res.status(400).json({
          status: false,
          message: 'Nama bidang dan Kuota wajib diisi',
        });
      }

      const kuotaInt = parseInt(kuota, 10);
      if (isNaN(kuotaInt) || kuotaInt < 1) {
        return res.status(400).json({
          status: false,
          message: 'Kuota harus berupa angka minimal 1',
        });
      }

      // --- PERBAIKAN ---
      // Hapus 'mode: insensitive', MySQL sudah case-insensitive by default
      const existing = await prisma.kuotaBidang.findFirst({
        where: { nama: nama },
      });
      // -------------------

      if (existing) {
        return res.status(409).json({
          status: false,
          message: 'Nama bidang sudah ada',
        });
      }

      const newBidang = await prisma.kuotaBidang.create({
        data: {
          nama,
          kuota: kuotaInt,
        },
      });

      return res.status(201).json({
        status: true,
        message: 'Bidang baru berhasil ditambahkan',
        data: { ...newBidang, pesertaAktif: 0 },
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
          message: 'Nama bidang dan Kuota wajib diisi',
          data: null,
        });
      }

      const kuotaInt = parseInt(kuota, 10);
      if (isNaN(kuotaInt) || kuotaInt < 1) {
        return res.status(400).json({
          status: false,
          message: 'Kuota harus berupa angka minimal 1',
          data: null,
        });
      }

      // --- PERBAIKAN DI SINI ---
      // Cek duplikat nama (MySQL sudah case-insensitive by default,
      // jadi 'mode: "insensitive"' tidak diperlukan dan menyebabkan error)
      const existing = await prisma.kuotaBidang.findFirst({
        where: {
          nama: nama, // Ini adalah shorthand untuk { equals: nama }
          NOT: { id: id },
        },
      });
      // -------------------------

      if (existing) {
        return res.status(409).json({
          status: false,
          message: 'Nama bidang sudah digunakan oleh bidang lain',
          data: null,
        });
      }

      const updatedBidang = await prisma.kuotaBidang.update({
        where: { id },
        data: {
          nama,
          kuota: kuotaInt,
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Bidang berhasil diperbarui',
        data: updatedBidang,
      });
    } catch (error) {
      // Tangani error jika ID tidak ditemukan
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return res.status(404).json({
          status: false,
          message: 'Bidang tidak ditemukan',
          data: null,
        });
      }
      next(error);
    }
  },

  // === Delete Bidang by ID (Fungsi baru) ===
  deleteKuotaBidang: async (req, res, next) => {
    try {
      const { id } = req.params;

      await prisma.kuotaBidang.delete({
        where: { id },
      });

      return res.status(200).json({
        status: true,
        message: 'Bidang berhasil dihapus',
      });
    } catch (error) {
      // Tangani error jika bidang tidak bisa dihapus (karena relasi 'Restrict')
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return res.status(409).json({
          status: false,
          message:
            'Gagal menghapus: Bidang ini masih digunakan oleh peserta atau ajuan magang.',
        });
      }
      // Tangani error jika ID tidak ditemukan
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return res.status(404).json({
          status: false,
          message: 'Bidang tidak ditemukan',
        });
      }
      next(error);
    }
  },
};
