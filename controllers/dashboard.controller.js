// Impor PrismaClient dan Prisma (untuk $queryRaw)
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

function getBusinessDays(startDate, endDate) {
  let count = 0;
  // Pastikan kita bekerja dengan objek Date
  const curDate = new Date(startDate.getTime());
  const lastDate = new Date(endDate.getTime());

  while (curDate <= lastDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // 0 = Minggu, 6 = Sabtu
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

/**
 * Menerjemahkan status usulan dari database ke teks yang ramah pengguna.
 */
function mapStatusUsulan(status) {
  if (!status) return null; // 'Belum Mengajukan Usulan' akan ditangani di frontend
  switch (status) {
    case 'PENDING':
      return 'Menunggu Persetujuan';
    case 'DISETUJUI':
      return 'Diterima';
    case 'DITOLAK':
      return 'Ditolak';
    default:
      return status;
  }
}

/**
 * Menerjemahkan status laporan akhir dari database.
 */
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

        prisma.pesertaMagang.count({ where: { status: 'APPROVED' } }),

        prisma.logbook.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

        prisma.laporanHasilMagang.count({ where: { status: 'PENDING' } }),

        prisma.ajuanMagang.count({ where: { statusUsulan: 'PENDING' } }),

        prisma.ajuanMagang.count({
          where: { statusUsulan: 'DISETUJUI', suratPenerimaan: null },
        }),

        prisma.laporanHasilMagang.count({ where: { status: 'APPROVED' } }),

        prisma.kritikSaran.count(),

        prisma.ulasanMagang.count(),
      ]);

      const bidangDataRaw = await prisma.kuotaBidang.findMany({
        select: {
          nama: true,
          _count: {
            select: {
              PesertaMagang: { where: { status: 'APPROVED' } },
            },
          },
        },
        where: {
          PesertaMagang: {
            some: { status: 'APPROVED' },
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
        _count: {
          id: true,
        },
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
            title: 'Surat Perlu Dikirim',
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
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          status: false,
          message: 'User ID tidak ditemukan.',
        });
      }

      // 1. Ambil data utama PesertaMagang dan relasi penting
      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userId },
        include: {
          user: { select: { email: true } }, // 1. Ambil email dari User
          bidang: { select: { nama: true } }, // 2. Ambil nama bidang YANG DITERIMA
          ajuan: {
            // 3. Ambil SEMUA ajuan
            orderBy: { createdAt: 'desc' },
            include: { bidang: { select: { nama: true } } }, // Ambil nama bidang usulan
          },
          logbook: { select: { id: true, tanggal: true } }, // 4. Ambil logbook untuk progres
          laporan: {
            // 5. Ambil laporan akhir
            orderBy: { createdAt: 'desc' }, // Ambil yang terbaru
          },
          sertifikat: { select: { id: true } }, // 6. Cek keberadaan sertifikat
        },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Profil peserta magang tidak ditemukan.',
        });
      }

      // 2. Ambil data Ulasan (terpisah karena terhubung ke User, bukan PesertaMagang)
      const ulasan = await prisma.ulasanMagang.findFirst({
        where: { userId: userId },
      });

      // 3. Proses dan format data untuk frontend

      // Temukan ajuan terbaru dan ajuan yang disetujui
      const latestAjuan = peserta.ajuan[0] || null;
      const approvedAjuan =
        peserta.ajuan.find((a) => a.statusUsulan === 'DISETUJUI') || null;

      // Hitung Progres Laporan Harian
      let laporanProgress = 0;
      if (approvedAjuan) {
        const tglMulai = new Date(approvedAjuan.tglMulai);
        const tglSelesai = new Date(approvedAjuan.tglSelesai);
        const totalHariKerja = getBusinessDays(tglMulai, tglSelesai);
        const logbookSubmitted = peserta.logbook.length;

        if (totalHariKerja > 0) {
          laporanProgress = Math.round(
            (logbookSubmitted / totalHariKerja) * 100
          );
          if (laporanProgress > 100) laporanProgress = 100; // Batasi di 100%
        }
      }

      // Ambil status Laporan Akhir
      const latestLaporan = peserta.laporan[0] || null;

      // 4. Susun data respons sesuai kebutuhan frontend
      const responseData = {
        // Data Profil Utama
        namaLengkap: peserta.namaLengkap,
        nimNis: peserta.nimNis,
        noTelepon: peserta.noTelepon,
        email: peserta.user.email,
        instansi: peserta.instansi,
        jurusan: peserta.jurusan,

        // Data Magang (dari ajuan yang disetujui)
        bidang: peserta.bidang?.nama || null, // Bidang yang sudah pasti
        periode: approvedAjuan
          ? {
              mulai: approvedAjuan.tglMulai,
              selesai: approvedAjuan.tglSelesai,
            }
          : null,

        // Data Status Usulan (dari ajuan terbaru)
        statusUsulan: mapStatusUsulan(latestAjuan?.statusUsulan),
        bidangUsulan: latestAjuan?.bidang.nama || null,
        tanggalPengajuan: latestAjuan?.createdAt || null,

        // Data Progres Dashboard
        laporanProgress: laporanProgress,
        laporanAkhir: mapStatusLaporan(latestLaporan?.status),
        ulasan: ulasan ? 'Sudah dikirim' : 'Belum dikirim',
        sertifikat:
          peserta.sertifikat.length > 0 ? 'Sudah terbit' : 'Belum terbit',
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
