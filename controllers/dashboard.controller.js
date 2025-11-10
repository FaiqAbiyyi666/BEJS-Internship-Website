const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

function mapStatusUsulan(status) {
  if (!status) return null;
  switch (status) {
    case 'PENDING':
      return 'Menunggu Persetujuan';
    case 'APPROVED':
      return 'Diterima';
    case 'REJECTED':
      return 'Ditolak';
    default:
      return status;
  }
}

function mapStatusLaporan(status) {
  if (!status) return 'Belum disubmit';
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'APPROVED':
      return 'Disetujui';
    case 'REJECTED':
      return 'Ditolak (Perlu Revisi)';
    default:
      return status;
  }
}

function calculateTotalDays(startDate, endDate) {
  const start = new Date(startDate.getTime());
  const end = new Date(endDate.getTime());
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

module.exports = {
  getDashboardStats: async (req, res, next) => {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 7
      );
      const currentYear = today.getFullYear();

      const activePesertaLogic = {
        status: 'APPROVED',
        ajuan: {
          some: {
            statusUsulan: 'APPROVED',
            tglMulai: { lte: today },
            tglSelesai: { gte: today },
            sertifikat: { is: null },
          },
        },
      };

      const [
        akunPending,
        pesertaAktif,
        laporanHarianMingguIni,
        laporanAkhirPending,
        ajuanMagangBaru,
        suratPerluDikirim,
        laporanSiapSertifikat,
        kritikSaran,
        ulasanMagang,
      ] = await prisma.$transaction([
        prisma.pesertaMagang.count({ where: { status: 'PENDING' } }),

        prisma.pesertaMagang.count({ where: activePesertaLogic }),

        prisma.logbook.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.laporanHasilMagang.count({ where: { status: 'PENDING' } }),
        prisma.ajuanMagang.count({ where: { statusUsulan: 'PENDING' } }),
        prisma.ajuanMagang.count({
          where: { statusUsulan: 'APPROVED', suratPenerimaan: null },
        }),

        prisma.ajuanMagang.count({
          where: {
            laporan: { status: 'APPROVED' },
            sertifikat: { is: null },
          },
        }),

        prisma.kritikSaran.count(),

        prisma.ulasanMagang.count(),
      ]);

      const bidangDataRaw = await prisma.kuotaBidang.findMany({
        select: {
          nama: true,
          _count: {
            select: {
              PesertaMagang: { where: activePesertaLogic },
            },
          },
        },
        where: {
          PesertaMagang: {
            some: activePesertaLogic,
          },
        },
      });

      const bidangData = bidangDataRaw.map((b) => ({
        name: b.nama,
        value: b._count.PesertaMagang,
      }));

      const ajuanDataRaw = await prisma.$queryRaw(
        Prisma.sql`SELECT DATE_FORMAT(created_at, '%b') as month, COUNT(*) as jumlah FROM AjuanMagang WHERE YEAR(created_at) = ${currentYear} GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b') ORDER BY DATE_FORMAT(created_at, '%Y-%m')`
      );

      const ajuanData = ajuanDataRaw.map((item) => ({
        ...item,
        jumlah: Number(item.jumlah),
      }));

      const laporanStatusRaw = await prisma.laporanHasilMagang.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      const statusCounts = laporanStatusRaw.reduce((acc, curr) => {
        acc[curr.status] = curr._count.id;
        return acc;
      }, {});

      const pending = statusCounts.PENDING || 0;
      const approved = statusCounts.APPROVED || 0;
      const rejected = statusCounts.REJECTED || 0;
      const total = pending + approved + rejected;

      const laporanStatus = [
        {
          name: 'Selesai',
          value:
            total > 0 ? Math.round(((approved + rejected) / total) * 100) : 0,
        },
        {
          name: 'Pending',
          value: total > 0 ? Math.round((pending / total) * 100) : 0,
        },
      ];

      const dashboardData = {
        stats: [
          { title: 'Akun Pending', value: akunPending, iconName: 'Users' },
          {
            title: 'Peserta Aktif',
            value: pesertaAktif,
            iconName: 'CheckCircle',
          },
          {
            title: 'Laporan Harian (Minggu Ini)',
            value: laporanHarianMingguIni,
            iconName: 'ClipboardList',
          },
          {
            title: 'Laporan Akhir Pending',
            value: laporanAkhirPending,
            iconName: 'FileText',
          },
          {
            title: 'Ajuan Magang Baru',
            value: ajuanMagangBaru,
            iconName: 'FileCheck',
          },
          {
            title: 'Sertifikat Perlu Diproses',
            value: laporanSiapSertifikat,
            iconName: 'Send',
          },
          {
            title: 'Surat Magang Perlu Dikirim',
            value: suratPerluDikirim,
            iconName: 'Mail',
          },
          {
            title: 'Kritik & Saran',
            value: kritikSaran,
            iconName: 'MessageSquare',
          },
          { title: 'Ulasan Magang', value: ulasanMagang, iconName: 'Star' },
        ],
        charts: {
          bidangData,
          ajuanData,
          laporanStatus,
        },
      };

      res.status(200).json({
        status: true,
        message: 'Data dashboard berhasil diambil.',
        data: dashboardData,
      });
    } catch (error) {
      next(error);
    }
  },

  getPesertaProfileDashboard: async (req, res, next) => {
    try {
      const userId = req.user.id;

      if (!userId) {
        return res.status(400).json({
          status: false,
          message: 'User ID tidak ditemukan dari token otentikasi.',
        });
      }

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userId },
        include: {
          user: { select: { email: true } },
          bidang: { select: { nama: true } },
          ajuan: {
            orderBy: { createdAt: 'desc' },
            include: {
              bidang: { select: { nama: true } },
              logbook: { select: { id: true, tanggal: true } },
              laporan: true,
              sertifikat: { select: { id: true } },
              ulasan: { select: { id: true } },
            },
          },
        },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Profil peserta magang tidak ditemukan.',
        });
      }

      const latestAjuan = peserta.ajuan[0] || null;

      const approvedAjuan =
        peserta.ajuan.find((a) => a.statusUsulan === 'APPROVED') || null;

      let laporanProgress = 0;
      if (approvedAjuan) {
        const tglMulai = new Date(approvedAjuan.tglMulai);
        const tglSelesai = new Date(approvedAjuan.tglSelesai);
        const totalHari = calculateTotalDays(tglMulai, tglSelesai);
        const logbookSubmitted = approvedAjuan.logbook.length;

        if (totalHari > 0) {
          laporanProgress = Math.round((logbookSubmitted / totalHari) * 100);
          if (laporanProgress > 100) laporanProgress = 100;
        }
      }

      const laporanAkhirData = approvedAjuan?.laporan || null;
      const sertifikatData = approvedAjuan?.sertifikat || null;
      const ulasanData = approvedAjuan?.ulasan || null;

      const responseData = {
        namaLengkap: peserta.namaLengkap,
        nimNis: peserta.nimNis,
        noTelepon: peserta.noTelepon,
        email: peserta.user.email,
        instansi: peserta.instansi,
        jurusan: peserta.jurusan,
        bidang: peserta.bidang?.nama || null,
        periode: approvedAjuan
          ? {
              mulai: approvedAjuan.tglMulai,
              selesai: approvedAjuan.tglSelesai,
            }
          : null,
        statusUsulan: mapStatusUsulan(latestAjuan?.statusUsulan),
        bidangUsulan: latestAjuan?.bidang.nama || null,
        tanggalPengajuan: latestAjuan?.createdAt || null,
        laporanProgress: laporanProgress,
        laporanAkhir: mapStatusLaporan(laporanAkhirData?.status),
        ulasan: ulasanData ? 'Sudah dikirim' : 'Belum dikirim',
        sertifikat: sertifikatData ? 'Sudah terbit' : 'Belum terbit',
      };

      res.status(200).json({
        status: true,
        message: 'Profil dan data dashboard peserta berhasil diambil.',
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  },
};
