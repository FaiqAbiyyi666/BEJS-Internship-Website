const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// const { prisma } = require('../utils/database');
const sendEmail = require('../utils/sendEmail');
const ejs = require('ejs');
const path = require('path');

const ITEMS_PER_PAGE = 10;

const checkEligibility = (ajuan) => {
  if (!ajuan) throw { code: 404, message: 'Data ajuan tidak ditemukan.' };
  if (ajuan.statusUsulan !== 'APPROVED')
    throw { code: 400, message: 'Ajuan belum disetujui.' };
  if (ajuan.sertifikat)
    throw { code: 400, message: 'Sertifikat sudah diterbitkan.' };
  if (ajuan.tglSelesai >= new Date())
    throw { code: 400, message: 'Periode magang belum selesai.' };
  if (!ajuan.laporan || !ajuan.ulasan)
    throw { code: 400, message: 'Laporan atau ulasan belum lengkap.' };

  // Cek Logbook
  const diffTime = Math.abs(ajuan.tglSelesai - ajuan.tglMulai);
  const expectedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (ajuan._count.logbook < expectedDays) {
    throw { code: 400, message: 'Logbook harian belum lengkap.' };
  }
};

// 2. Fungsi khusus menangani notifikasi (Fire & Forget)
const sendCertificateEmail = async (peserta, bidang, link) => {
  if (!peserta.user.email) return;
  try {
    const html = await ejs.renderFile(
      path.join(__dirname, '../views/sendNotifCertificate.ejs'),
      {
        namaPeserta: peserta.namaLengkap,
        namaBidang: bidang,
        downloadLink: link,
      }
    );
    await sendEmail({
      to: peserta.user.email,
      subject: 'Sertifikat Magang Terbit',
      html,
    });
  } catch (err) {
    console.error('Email error:', err);
  }
};

module.exports = {
  kirimSertifikat: async (req, res, next) => {
    try {
      const { ajuanId, noSertifikat, nilai, fileUrl } = req.body;

      if (!ajuanId || !noSertifikat || !nilai || !fileUrl) {
        return res
          .status(400)
          .json({ status: false, message: 'Data tidak lengkap.' });
      }

      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        include: {
          bidang: true,
          peserta: { include: { user: true } },
          laporan: true,
          sertifikat: true,
          ulasan: true,
          _count: { select: { logbook: true } },
        },
      });

      checkEligibility(ajuan);

      const newSertifikat = await prisma.sertifikat.create({
        data: {
          noSertifikat: noSertifikat,
          nilai: parseInt(nilai, 10),
          fileUrl: fileUrl,
          ajuan: {
            connect: { id: ajuanId },
          },
        },
      });

      const link = `${process.env.CLIENT_BASE_URL}/dashboard/sertifikat`;
      sendCertificateEmail(ajuan.peserta, ajuan.bidang.nama, link);

      res.status(201).json({
        status: true,
        message:
          'Sertifikat berhasil dikirim dan notifikasi email sedang diproses.',
        data: newSertifikat,
      });
    } catch (error) {
      console.error('Gagal mengirim sertifikat:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({
          status: false,
          message: 'Gagal mengirim sertifikat. Peserta magang tidak ditemukan.',
          data: null,
        });
      }
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server.',
        data: null,
      });
    }
  },

  getHistorySertifikat: async (req, res, next) => {
    try {
      const { page = 1, search, bidang, tanggal } = req.query;
      const skip = (parseInt(page, 10) - 1) * ITEMS_PER_PAGE;

      let where = {};
      let conditions = [];

      if (tanggal) {
        const tgl = new Date(tanggal);
        const tglBesok = new Date(tgl);
        tglBesok.setDate(tgl.getDate() + 1);
        conditions.push({
          createdAt: {
            gte: tgl,
            lt: tglBesok,
          },
        });
      }

      if (bidang) {
        conditions.push({
          ajuan: {
            bidangId: bidang,
          },
        });
      }

      if (search) {
        conditions.push({
          OR: [
            { noSertifikat: { contains: search } },
            {
              ajuan: {
                peserta: {
                  namaLengkap: { contains: search },
                },
              },
            },
          ],
        });
      }

      if (conditions.length > 0) {
        where.AND = conditions;
      }

      const totalItems = await prisma.sertifikat.count({
        where,
      });
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

      const history = await prisma.sertifikat.findMany({
        where,
        skip,
        take: ITEMS_PER_PAGE,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          ajuan: {
            include: {
              peserta: {
                select: {
                  namaLengkap: true,
                },
              },
              bidang: {
                select: {
                  nama: true,
                },
              },
            },
          },
        },
      });

      res.status(200).json({
        status: true,
        message: 'Riwayat sertifikat berhasil diambil.',
        data: {
          history,
          totalPages,
          totalItems,
          currentPage: parseInt(page, 10),
        },
      });
    } catch (error) {
      console.error('Gagal mengambil riwayat sertifikat:', error);
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server.',
        data: null,
      });
    }
  },

  getSertifikat: async (req, res, next) => {
    try {
      const userIdFromToken = req.user.id;

      const peserta = await prisma.pesertaMagang.findUnique({
        where: {
          userId: userIdFromToken,
        },
        select: {
          id: true,
        },
      });

      if (!peserta) {
        return res.status(401).json({
          status: false,
          message: 'Akses ditolak. Data peserta magang tidak terkait.',
          data: null,
        });
      }

      const ajuans = await prisma.ajuanMagang.findMany({
        where: { pesertaId: peserta.id },
        include: {
          sertifikat: true,
          bidang: { select: { nama: true } },
        },
        orderBy: {
          tglSelesai: 'desc',
        },
      });

      if (!ajuans || ajuans.length === 0) {
        return res.status(200).json({
          status: true,
          message: 'Anda belum pernah mengajukan magang.',
          data: [],
        });
      }

      const approvedAjuans = ajuans.filter(
        (a) => a.statusUsulan === 'APPROVED'
      );
      if (approvedAjuans.length === 0) {
        return res.status(200).json({
          status: true,
          message:
            'Ajuan magang Anda masih PENDING atau telah DITOLAK. Sertifikat hanya terbit untuk ajuan yang DITERIMA.',
          data: [],
        });
      }

      const certifiedAjuans = approvedAjuans.filter((a) => a.sertifikat);

      const formattedList = certifiedAjuans.map((item) => ({
        id: item.sertifikat.id,
        noSertifikat: item.sertifikat.noSertifikat,
        nilai: item.sertifikat.nilai,
        fileUrl: item.sertifikat.fileUrl,
        createdAt: item.sertifikat.createdAt,
        bidang: item.bidang.nama,
        tglMulai: item.tglMulai,
        tglSelesai: item.tglSelesai,
      }));

      if (formattedList.length > 0) {
        return res.status(200).json({
          status: true,
          message: 'Sertifikat berhasil diambil.',
          data: formattedList,
        });
      }

      const mostRecentApprovedAjuan = approvedAjuans[0];

      if (mostRecentApprovedAjuan.tglSelesai >= new Date()) {
        return res.status(200).json({
          status: true,
          message:
            'Sertifikat belum terbit. Selesaikan program magang Anda terlebih dahulu.',
          data: [],
        });
      } else {
        return res.status(200).json({
          status: true,
          message:
            'Program magang Anda telah selesai. Sertifikat sedang diproses oleh Admin.',
          data: [],
        });
      }
    } catch (error) {
      console.error('Gagal mengambil data sertifikat:', error);
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server.',
        data: null,
      });
    }
  },

  getAjuanForSertifikat: async (req, res, next) => {
    try {
      const ajuans = await prisma.ajuanMagang.findMany({
        where: {
          statusUsulan: 'APPROVED',
          tglSelesai: {
            lt: new Date(),
          },
          sertifikat: null,

          laporan: { isNot: null },
          ulasan: { isNot: null },
        },
        select: {
          id: true,
          peserta: { select: { namaLengkap: true } },
          bidang: { select: { nama: true } },
          tglSelesai: true,
        },
        orderBy: {
          tglSelesai: 'desc',
        },
      });

      const formattedAjuans = ajuans.map((a) => ({
        id: a.id,
        namaDisplay: `${a.peserta.namaLengkap} (${
          a.bidang.nama
        } | Selesai ${a.tglSelesai.toLocaleDateString('id-ID')})`,
      }));

      res.status(200).json({
        status: true,
        message: 'Data ajuan yang siap menerima sertifikat berhasil diambil.',
        data: formattedAjuans,
      });
    } catch (error) {
      console.error('Gagal mengambil daftar ajuan:', error);
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server.',
        data: null,
      });
    }
  },
};
