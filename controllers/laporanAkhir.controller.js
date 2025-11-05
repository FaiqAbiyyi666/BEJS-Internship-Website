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

      const ajuan = await prisma.ajuanMagang.findFirst({
        where: {
          pesertaId: peserta.id,
          statusUsulan: 'APPROVED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          tglSelesai: true,
        },
      });

      if (!ajuan) {
        return res.status(404).json({
          msg: 'Tidak ditemukan ajuan magang yang disetujui untuk mengirim laporan.',
        });
      }

      const submissionWindowDays = 7; // Laporan bisa dikirim 7 hari sebelum selesai
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalisasi 'hari ini' ke tengah malam

      const tglSelesai = new Date(ajuan.tglSelesai);
      tglSelesai.setHours(0, 0, 0, 0); // Normalisasi tanggal selesai

      // Hitung tanggal kapan submisi mulai dibuka
      const submissionStartDate = new Date(tglSelesai);
      submissionStartDate.setDate(tglSelesai.getDate() - submissionWindowDays);

      // Cek apakah hari ini MASIH SEBELUM masa submisi
      if (today < submissionStartDate) {
        const tglMulaiSubmisi = submissionStartDate.toLocaleDateString(
          'id-ID',
          {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }
        );
        return res.status(403).json({
          msg: `Anda belum bisa mengirim laporan. Laporan hanya bisa dikirim dalam ${submissionWindowDays} hari terakhir periode magang Anda (mulai tanggal ${tglMulaiSubmisi}).`,
        });
      }
      const existingLaporan = await prisma.laporanHasilMagang.findFirst({
        where: {
          ajuanId: ajuan.id,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });

      if (existingLaporan) {
        return res.status(400).json({
          msg: 'Anda sudah memiliki laporan yang sedang direview atau sudah diterima untuk ajuan ini.',
        });
      }

      const newLaporan = await prisma.laporanHasilMagang.create({
        data: {
          fileLaporan: fileUrl,
          status: 'PENDING',
          ajuanId: ajuan.id,
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

      const ajuans = await prisma.ajuanMagang.findMany({
        where: { pesertaId: peserta.id },
        select: { id: true },
      });

      const ajuanIds = ajuans.map((a) => a.id);

      if (ajuanIds.length === 0) {
        return res.status(200).json([]);
      }

      const history = await prisma.laporanHasilMagang.findMany({
        where: {
          ajuanId: {
            in: ajuanIds,
          },
        },
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
          ajuan: {
            include: {
              peserta: {
                include: {
                  user: { select: { email: true } },
                  bidang: { select: { nama: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formattedLaporan = laporanPending.map((l) => ({
        id: l.id,
        fileLaporan: l.fileLaporan,
        createdAt: l.createdAt,
        peserta: {
          nama: l.ajuan.peserta.namaLengkap,
          email: l.ajuan.peserta.user.email,
          bidang: l.ajuan.peserta.bidang ? l.ajuan.peserta.bidang.nama : 'N/A',
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
          ajuan: {
            include: {
              peserta: {
                include: {
                  user: { select: { email: true } },
                  bidang: { select: { nama: true } },
                },
              },
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
          nama: l.ajuan.peserta.namaLengkap,
          email: l.ajuan.peserta.user.email,
          bidang: l.ajuan.peserta.bidang ? l.ajuan.peserta.bidang.nama : 'N/A',
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
