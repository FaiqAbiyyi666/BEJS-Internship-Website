const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  createKritikSaran: async (req, res, next) => {
    try {
      const { nama, email, pesan } = req.body;
      const userId = req.user ? req.user.id : null;

      if (!nama || !email || !pesan) {
        return res.status(400).json({
          status: false,
          message: 'Nama, email, dan pesan wajib diisi.',
        });
      }

      const dataToCreate = {
        nama,
        email,
        pesan,
      };

      // Jika userId ada (user sedang login), hubungkan relasinya
      if (userId) {
        dataToCreate.user = {
          connect: { id: userId },
        };
      }

      const kritikSaran = await prisma.kritikSaran.create({
        data: dataToCreate,
      });

      res.status(201).json({
        status: true,
        message: 'Kritik dan saran berhasil dikirim. Terima kasih!',
        data: kritikSaran,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * (ADMIN) Mengambil semua data kritik dan saran untuk dashboard admin.
   * Mendukung filtering berdasarkan search (nama/email/pesan) dan tanggal.
   */
  getAllKritikSaran: async (req, res, next) => {
    try {
      // Ambil query params dari frontend admin
      const { search, date } = req.query;

      const where = {};

      // 1. Filter Pencarian
      if (search) {
        where.OR = [
          { nama: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { pesan: { contains: search, mode: 'insensitive' } },
        ];
      }

      // 2. Filter Tanggal
      if (date) {
        const startDate = new Date(date); // YYYY-MM-DD
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1); // Set ke hari berikutnya jam 00:00

        where.createdAt = {
          gte: startDate,
          lt: endDate,
        };
      }

      const kritikSaranList = await prisma.kritikSaran.findMany({
        where: where,
        orderBy: {
          createdAt: 'desc', // Tampilkan yang terbaru dulu
        },
      });

      res.status(200).json({
        status: true,
        message: 'Data kritik dan saran berhasil diambil.',
        data: kritikSaranList,
      });
    } catch (error) {
      next(error);
    }
  },
};
