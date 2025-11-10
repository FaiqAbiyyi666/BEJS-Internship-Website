const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  getAllKuotaBidang: async (req, res, next) => {
    try {
      const today = new Date(); // <--- Tambahkan tanggal hari ini

      const bidangWithCount = await prisma.kuotaBidang.findMany({
        include: {
          _count: {
            select: {
              // Hitung relasi PesertaMagang
              PesertaMagang: {
                // <--- AWAL LOGIKA BARU ---
                where: {
                  status: 'APPROVED', // 1. Profilnya disetujui
                  ajuan: {
                    // 2. Dan punya setidaknya satu ajuan
                    some: {
                      statusUsulan: 'APPROVED', // 3. Yang ajuannya disetujui
                      tglMulai: { lte: today }, // 4. Sudah dimulai
                      tglSelesai: { gte: today }, // 5. Dan belum selesai
                      sertifikat: { is: null }, // 6. Dan belum lulus
                    },
                  },
                },
                // <--- AKHIR LOGIKA BARU ---
              },
            },
          },
        },
        orderBy: {
          nama: 'asc',
        },
      });

      const data = bidangWithCount.map((bidang) => ({
        id: bidang.id,
        nama: bidang.nama,
        kuota: bidang.kuota,
        pesertaAktif: bidang._count.PesertaMagang, // Ini sekarang jadi akurat
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

  getKuotaBidangById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const today = new Date(); // <--- Tambahkan tanggal hari ini

      const bidang = await prisma.kuotaBidang.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              PesertaMagang: {
                // <--- AWAL LOGIKA BARU ---
                where: {
                  status: 'APPROVED',
                  ajuan: {
                    some: {
                      statusUsulan: 'APPROVED',
                      tglMulai: { lte: today },
                      tglSelesai: { gte: today },
                      sertifikat: { is: null },
                    },
                  },
                },
                // <--- AKHIR LOGIKA BARU ---
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

      const data = {
        id: bidang.id,
        nama: bidang.nama,
        kuota: bidang.kuota,
        pesertaAktif: bidang._count.PesertaMagang, // Ini sekarang jadi akurat
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

      const existing = await prisma.kuotaBidang.findFirst({
        where: { nama: nama },
      });

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

      const existing = await prisma.kuotaBidang.findFirst({
        where: {
          nama: nama,
          NOT: { id: id },
        },
      });

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
