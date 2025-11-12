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

  getAllKritikSaran: async (req, res, next) => {
    try {
      const { search, date } = req.query;

      const where = {};

      if (search) {
        where.OR = [
          { nama: { contains: search } },
          { email: { contains: search } },
          { pesan: { contains: search } },
        ];
      }

      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);

        where.createdAt = {
          gte: startDate,
          lt: endDate,
        };
      }

      const kritikSaranList = await prisma.kritikSaran.findMany({
        where: where,
        orderBy: {
          createdAt: 'desc',
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
