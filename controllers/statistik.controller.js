const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  getStatistik: async (req, res, next) => {
    try {
      const currentYear = new Date().getFullYear();

      const pengunjungData = await prisma.statistikPengunjung.findUnique({
        where: { tahun: currentYear },
      });

      const [totalPendaftar, pesertaAktif, pesertaLulus] =
        await prisma.$transaction([
          prisma.pesertaMagang.count(),

          prisma.pesertaMagang.count({ where: { status: 'APPROVED' } }),

          prisma.pesertaMagang.count({
            where: {
              ajuan: {
                some: {
                  sertifikat: {
                    isNot: null, 
                  },
                },
              },
            },
          }),
        ]);

      res.status(200).json({
        data: {
          pengunjung: pengunjungData ? pengunjungData.count : 0,
          aktif: pesertaAktif,
          lulus: pesertaLulus,
          pendaftar: totalPendaftar,
        },
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      next(error);
    }
  },

  incrementStatistik: async (req, res, next) => {
    try {
      const currentYear = new Date().getFullYear();

      await prisma.statistikPengunjung.upsert({
        where: { tahun: currentYear },
        create: { tahun: currentYear, count: 1 },
        update: { count: { increment: 1 } },
      });

      res.status(200).json({ message: 'Count incremented successfully' });
    } catch (error) {
      console.error('Error incrementing stats:', error);
      next(error);
    }
  },
};
