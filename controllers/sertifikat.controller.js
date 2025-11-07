const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');
const ejs = require('ejs');
const path = require('path');

const ITEMS_PER_PAGE = 10;

module.exports = {
  kirimSertifikat: async (req, res, next) => {
    try {
      const { ajuanId, noSertifikat, nilai } = req.body;
      const { fileUrl } = req.body;

      if (!ajuanId || !noSertifikat || !nilai || !fileUrl) {
        return res.status(400).json({
          status: false,
          message: 'Ajuan, nomor sertifikat, nilai, dan file wajib diisi.',
          data: null,
        });
      }

      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        include: {
          bidang: true,
          peserta: { include: { user: true } },
          laporan: true,
          _count: {
            select: { logbook: true },
          },
          sertifikat: true,
        },
      });

      if (!ajuan || ajuan.statusUsulan !== 'APPROVED') {
        return res.status(404).json({
          status: false,
          message:
            'Gagal. Data ajuan magang yang DITERIMA untuk peserta ini tidak ditemukan.',
          data: null,
        });
      }

      if (ajuan.sertifikat) {
        return res.status(400).json({
          status: false,
          message:
            'Gagal. Sertifikat untuk ajuan ini sudah pernah diterbitkan.',
          data: null,
        });
      }

      if (ajuan.tglSelesai >= new Date()) {
        return res.status(400).json({
          status: false,
          message: `Gagal. Periode magang belum selesai (Selesai pada: ${ajuan.tglSelesai.toLocaleDateString(
            'id-ID'
          )}).`,
          data: null,
        });
      }

      if (!ajuan.laporan) {
        return res.status(400).json({
          status: false,
          message: 'Gagal. Peserta belum mengunggah laporan akhir.',
          data: null,
        });
      }

      const ulasan = await prisma.ulasanMagang.findFirst({
        where: { userId: ajuan.peserta.userId },
      });
      if (!ulasan) {
        return res.status(400).json({
          status: false,
          message: 'Gagal. Peserta belum mengisi ulasan magang.',
          data: null,
        });
      }

      const tglMulai = ajuan.tglMulai;
      const tglSelesai = ajuan.tglSelesai;

      const diffTime = Math.abs(tglSelesai - tglMulai);
      const expectedLogbooks = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const actualLogbooks = ajuan._count.logbook;

      if (actualLogbooks < expectedLogbooks) {
        return res.status(400).json({
          status: false,
          message: `Gagal. Logbook peserta belum lengkap (Terisi: ${actualLogbooks} / Wajib: ${expectedLogbooks} hari).`,
          data: null,
        });
      }

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

      const { email: emailPeserta } = ajuan.peserta.user;
      const { namaLengkap: namaPeserta } = ajuan.peserta;

      if (!emailPeserta) {
        console.error(
          `Gagal mengirim email sertifikat: Email tidak ditemukan untuk peserta ${namaPeserta} (ID: ${ajuan.peserta.id})`
        );
        return res.status(201).json({
          status: true,
          message: `Sertifikat berhasil dikirim. PERINGATAN: Notifikasi email GAGAL terkirim.`,
          data: newSertifikat,
        });
      }

      const downloadLink = `${process.env.CLIENT_BASE_URL}/dashboard/sertifikat`;
      const emailSubject = 'Sertifikat Magang Anda Telah Terbit! 📬';
      const templateData = {
        namaPeserta: namaPeserta,
        namaBidang: ajuan.bidang.nama,
        downloadLink: downloadLink,
      };

      const templatePath = path.join(
        __dirname,
        '../views/sendNotifCertificate.ejs'
      );

      ejs.renderFile(templatePath, templateData, (err, html) => {
        if (err) {
          console.error('Gagal me-render EJS untuk email sertifikat:', err);
        } else {
          sendEmail({
            from: process.env.SENDER_GMAIL,
            to: emailPeserta,
            subject: emailSubject,
            html: html,
          }).catch((emailError) => {
            console.error(
              'Gagal mengirim email notifikasi sertifikat:',
              emailError
            );
          });
        }
      });

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

      // 2. Filter Bidang (Asumsi 'bidang' adalah bidangId)
      if (bidang) {
        conditions.push({
          ajuan: {
            bidangId: bidang,
          },
        });
      }

      // 3. Filter Search
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

      // Gabungkan semua kondisi dengan 'AND'
      if (conditions.length > 0) {
        where.AND = conditions;
      }

      const totalItems = await prisma.sertifikat.count({
        where, // Gunakan 'where' yang sudah diperbaiki
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

  getPesertaForSertifikat: async (req, res, next) => {
    try {
      const peserta = await prisma.pesertaMagang.findMany({
        where: {
          status: 'APPROVED',
        },
        select: {
          id: true,
          namaLengkap: true,
        },
        orderBy: {
          namaLengkap: 'asc',
        },
      });

      res.status(200).json({
        status: true,
        message: 'Data peserta berhasil diambil.',
        data: peserta,
      });
    } catch (error) {
      console.error('Gagal mengambil daftar peserta:', error);
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server.',
        data: null,
      });
    }
  },
};
