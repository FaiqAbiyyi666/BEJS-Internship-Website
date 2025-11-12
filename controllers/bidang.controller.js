const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  getAllBidang: async (req, res) => {
    try {
      const bidang = await prisma.kuotaBidang.findMany({
        select: {
          id: true,
          nama: true,
        },
        orderBy: {
          nama: 'asc',
        },
      });
      res.status(200).json({ data: bidang });
    } catch (error) {
      console.error('Error [getAllBidang]:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getAllKuotaBidang: async (req, res, next) => {
    try {
      const today = new Date();

      const bidangWithCount = await prisma.kuotaBidang.findMany({
        include: {
          _count: {
            select: {
              PesertaMagang: {
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

  getKuotaBidangById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const today = new Date();

      const bidang = await prisma.kuotaBidang.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              PesertaMagang: {
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
