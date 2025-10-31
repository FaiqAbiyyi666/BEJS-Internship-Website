const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  submitLaporan: async (req, res) => {
    const { id: userId } = req.user;
    const { fileUrl } = req.imagekit_file_info;

    try {
      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userId },
        select: { id: true },
      });

      if (!peserta) {
        return res
          .status(404)
          .json({ msg: 'Profil peserta magang tidak ditemukan.' });
      }

      const existingLaporan = await prisma.laporanHasilMagang.findFirst({
        where: {
          pesertaId: peserta.id,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });

      if (existingLaporan) {
        return res.status(400).json({
          msg: 'Anda sudah memiliki laporan yang sedang direview atau sudah diterima.',
        });
      }

      const newLaporan = await prisma.laporanHasilMagang.create({
        data: {
          fileLaporan: fileUrl,
          pesertaId: peserta.id,
          status: 'PENDING',
        },
      });

      res
        .status(201)
        .json({ msg: 'Laporan berhasil diunggah.', data: newLaporan });
    } catch (error) {
      console.error('Submit Laporan Error:', error);
      res.status(500).json({ msg: 'Terjadi kesalahan server.' });
    }
  },

  getMyLaporanHistory: async (req, res) => {
    const { id: userId } = req.user;

    try {
      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userId },
        select: { id: true },
      });

      if (!peserta) {
        return res
          .status(404)
          .json({ msg: 'Profil peserta magang tidak ditemukan.' });
      }

      const history = await prisma.laporanHasilMagang.findMany({
        where: { pesertaId: peserta.id },
        orderBy: { createdAt: 'desc' },
      });

      const formattedHistory = history.map((item) => ({
        id: item.id,
        namaFile: item.fileLaporan.split('/').pop(),
        tanggalUpload: item.createdAt,
        status: item.status,
        fileUrl: item.fileLaporan,
        catatan: item.catatan,
      }));

      res.status(200).json(formattedHistory);
    } catch (error) {
      console.error('Get My Laporan History Error:', error);
      res.status(500).json({ msg: 'Terjadi kesalahan server.' });
    }
  },

  getLaporanMasuk: async (req, res) => {
    try {
      const laporanPending = await prisma.laporanHasilMagang.findMany({
        where: { status: 'PENDING' },
        include: {
          peserta: {
            include: {
              user: { select: { email: true } }, // Ambil email
              bidang: { select: { nama: true } }, // Ambil nama bidang
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Format data agar sesuai ekspektasi frontend (ManageLaporanAkhir.jsx)
      const formattedLaporan = laporanPending.map((l) => ({
        id: l.id,
        fileLaporan: l.fileLaporan,
        createdAt: l.createdAt,
        peserta: {
          nama: l.peserta.namaLengkap,
          email: l.peserta.user.email,
          bidang: l.peserta.bidang ? l.peserta.bidang.nama : 'N/A',
        },
      }));

      res.status(200).json(formattedLaporan);
    } catch (error) {
      console.error('Get Laporan Masuk Error:', error);
      res.status(500).json({ msg: 'Terjadi kesalahan server.' });
    }
  },

  getLaporanRiwayat: async (req, res) => {
    try {
      const laporanRiwayat = await prisma.laporanHasilMagang.findMany({
        where: { status: { in: ['APPROVED', 'REJECTED'] } },
        include: {
          peserta: {
            include: {
              user: { select: { email: true } },
              bidang: { select: { nama: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const formattedRiwayat = laporanRiwayat.map((l) => ({
        id: l.id,
        fileLaporan: l.fileLaporan,
        status: l.status,
        respondedAt: l.updatedAt,
        catatan: l.catatan,
        peserta: {
          nama: l.peserta.namaLengkap,
          email: l.peserta.user.email,
          bidang: l.peserta.bidang ? l.peserta.bidang.nama : 'N/A',
        },
      }));

      res.status(200).json(formattedRiwayat);
    } catch (error) {
      console.error('Get Laporan Riwayat Error:', error);
      res.status(500).json({ msg: 'Terjadi kesalahan server.' });
    }
  },

  responseLaporan: async (req, res) => {
    const { id } = req.params;
    const { status, catatan } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ msg: 'Status tidak valid.' });
    }

    if (status === 'REJECTED' && (!catatan || catatan.trim() === '')) {
      return res
        .status(400)
        .json({ msg: 'Catatan wajib diisi untuk penolakan.' });
    }

    try {
      const laporan = await prisma.laporanHasilMagang.findUnique({
        where: { id },
      });

      if (!laporan) {
        return res.status(404).json({ msg: 'Laporan tidak ditemukan.' });
      }
      if (laporan.status !== 'PENDING') {
        return res.status(400).json({ msg: 'Laporan ini sudah direspon.' });
      }

      const updatedLaporan = await prisma.laporanHasilMagang.update({
        where: { id: id },
        data: {
          status: status,
          catatan: status === 'REJECTED' ? catatan : null,
        },
      });

      res.status(200).json({
        msg: `Laporan berhasil ${
          status === 'APPROVED' ? 'diterima' : 'ditolak'
        }.`,
        data: updatedLaporan,
      });
    } catch (error) {
      console.error('Respond Laporan Error:', error);
      res.status(500).json({ msg: 'Terjadi kesalahan server.' });
    }
  },
};
