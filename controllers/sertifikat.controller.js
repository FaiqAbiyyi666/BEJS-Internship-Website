// Import dependency yang diperlukan di atas file Anda
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');
const ejs = require('ejs');
const path = require('path');

const ITEMS_PER_PAGE = 10; // Tentukan jumlah item per halaman untuk admin

module.exports = {
  kirimSertifikat: async (req, res, next) => {
    try {
      // 1. Ambil data dari form (req.body)
      const { pesertaId, noSertifikat, nilai } = req.body;
      const { fileUrl } = req.body; // Dari middleware

      // 2. Validasi input
      if (!pesertaId || !noSertifikat || !nilai || !fileUrl) {
        return res.status(400).json({
          status: false,
          message: 'Peserta, nomor sertifikat, nilai, dan file wajib diisi.',
          data: null,
        });
      }

      // 3. Cari AjuanMagang yang DITERIMA
      const ajuanDiterima = await prisma.ajuanMagang.findFirst({
        where: {
          pesertaId: pesertaId,
          statusUsulan: 'DITERIMA',
        },
        include: {
          bidang: true, // Kita perlu nama bidang
        },
      });

      if (!ajuanDiterima) {
        return res.status(404).json({
          status: false,
          message:
            'Gagal. Data ajuan magang yang DITERIMA untuk peserta ini tidak ditemukan.',
          data: null,
        });
      }

      // 4. Simpan ke Database
      const newSertifikat = await prisma.sertifikat.create({
        data: {
          noSertifikat: noSertifikat,
          nilai: parseInt(nilai, 10),
          bidang: ajuanDiterima.bidang.nama, // Diambil dari ajuan
          fileUrl: fileUrl,
          tglMulai: ajuanDiterima.tglMulai, // Diambil dari ajuan
          tglSelesai: ajuanDiterima.tglSelesai, // Diambil dari ajuan
          peserta: {
            connect: { id: pesertaId },
          },
        },
        include: {
          peserta: {
            select: {
              id: true,
              namaLengkap: true,
              user: { select: { email: true } },
            },
          },
        },
      });

      // 5. Kirim Email Notifikasi
      const { email: emailPeserta } = newSertifikat.peserta.user;
      const { namaLengkap: namaPeserta } = newSertifikat.peserta;

      if (!emailPeserta) {
        console.error(
          `Gagal mengirim email sertifikat: Email tidak ditemukan untuk peserta ${namaPeserta} (ID: ${newSertifikat.peserta.id})`
        );

        return res.status(201).json({
          status: true,
          message: `Sertifikat berhasil dikirim. PERINGATAN: Notifikasi email GAGAL terkirim (email peserta tidak terdaftar).`,
          data: newSertifikat,
        });
      }

      // Persiapan data EJS
      const downloadLink = `${process.env.CLIENT_BASE_URL}/dashboard/sertifikat`;
      const emailSubject = 'Sertifikat Magang Anda Telah Terbit! 📬';
      const templateData = {
        namaPeserta: namaPeserta,
        namaBidang: newSertifikat.bidang,
        downloadLink: downloadLink,
      };
      const templatePath = path.join(
        __dirname,
        '../views/sendNotifCertificate.ejs' // Path Anda
      );

      // Render dan kirim email
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

      // 6. Kirim Respon Sukses
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

      // 1. Tentukan Kondisi Filter (where)
      let where = {};

      // Filter Pencarian
      if (search) {
        where.OR = [
          { peserta: { namaLengkap: { contains: search } } },
          { noSertifikat: { contains: search } },
        ];
      }

      // Filter Bidang (disimpan sebagai string di Sertifikat, jadi filter 'equals')
      if (bidang) {
        where.bidang = { equals: bidang };
      }

      // Filter Tanggal (berdasarkan tanggal dibuatnya sertifikat)
      if (tanggal) {
        const tgl = new Date(tanggal);
        const tglBesok = new Date(tgl);
        tglBesok.setDate(tgl.getDate() + 1);

        where.createdAt = {
          gte: tgl,
          lt: tglBesok,
        };
      }

      // 2. Hitung total data untuk paginasi
      const totalItems = await prisma.sertifikat.count({
        where,
      });
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

      // 3. Ambil data sertifikat dengan paginasi dan filter
      const history = await prisma.sertifikat.findMany({
        where,
        skip,
        take: ITEMS_PER_PAGE,
        orderBy: {
          createdAt: 'desc', // Tampilkan yang terbaru dulu
        },
        include: {
          // Kita perlu nama peserta untuk ditampilkan di tabel
          peserta: {
            select: {
              namaLengkap: true,
            },
          },
        },
      });

      // 4. Kirim respon
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
      // 1. Ambil 'id' user dari payload token (req.user)
      const userIdFromToken = req.user.id; // Asumsi payload berisi 'id'

      // 2. Cari data PesertaMagang menggunakan userId
      const peserta = await prisma.pesertaMagang.findUnique({
        where: {
          userId: userIdFromToken,
        },
        select: {
          id: true, // Kita hanya perlu ID-nya
        },
      });

      if (!peserta) {
        return res.status(401).json({
          status: false,
          message: 'Akses ditolak. Data peserta magang tidak terkait.',
          data: null,
        });
      }

      // 3. Gunakan peserta.id untuk query sertifikat
      const sertifikatList = await prisma.sertifikat.findMany({
        where: {
          pesertaId: peserta.id, // Gunakan ID peserta yang baru ditemukan
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.status(200).json({
        status: true,
        message: 'Sertifikat berhasil diambil.',
        data: sertifikatList,
      });
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
          status: 'APPROVED', // Hanya ambil peserta yang sudah LULUS/APPROVED
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
