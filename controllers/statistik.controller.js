const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  getStatistik: async (req, res, next) => {
    try {
      const currentYear = new Date().getFullYear();
      const today = new Date(); // Dapatkan tanggal hari ini

      const pengunjungData = await prisma.statistikPengunjung.findUnique({
        where: { tahun: currentYear },
      });

      const [totalPendaftar, pesertaAktif, pesertaLulus] =
        await prisma.$transaction([
          // 1. Total Pendaftar (Sudah Benar)
          prisma.pesertaMagang.count(),

          // 2. Peserta Aktif (DIPERBAIKI)
          prisma.pesertaMagang.count({
            where: {
              status: 'APPROVED', // 1. Profil peserta disetujui
              ajuan: {
                some: {
                  statusUsulan: 'APPROVED', // 2. Ajuan magangnya disetujui
                  tglMulai: { lte: today }, // 3. Tanggal mulai sudah lewat atau hari ini
                  tglSelesai: { gte: today }, // 4. Tanggal selesai adalah hari ini atau di masa depan
                  sertifikat: { is: null }, // 5. Dan belum mendapat sertifikat (belum lulus)
                },
              },
            },
          }),

          // 3. Peserta Lulus (Sudah Benar)
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

  // Fungsi incrementStatistik Anda sudah benar
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
