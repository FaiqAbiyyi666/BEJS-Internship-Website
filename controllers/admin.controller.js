const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const ejs = require('ejs');
const path = require('path');

module.exports = {
  createAdmin: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: false,
          message: 'Email dan password wajib diisi',
          data: null,
        });
      }

      const exist = await prisma.user.findUnique({ where: { email } });
      if (exist) {
        return res.status(409).json({
          status: false,
          message: 'Email sudah digunakan',
          data: null,
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'admin',
        },
      });

      const admin = await prisma.admin.create({
        data: {
          userId: user.id,
        },
      });

      res.status(201).json({
        status: true,
        message: 'Akun admin berhasil dibuat',
        data: { user, admin },
      });
    } catch (error) {
      next(error);
    }
  },

  createSubKoordinator: async (req, res, next) => {
    try {
      const { email, password, nama, bidangId } = req.body;

      if (!email || !password || !nama || !bidangId) {
        return res.status(400).json({
          status: false,
          message: 'Email, password, nama, dan bidangId wajib diisi',
          data: null,
        });
      }

      const exist = await prisma.user.findUnique({ where: { email } });
      if (exist) {
        return res.status(409).json({
          status: false,
          message: 'Email sudah digunakan',
          data: null,
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'sub_koordinator_bidang',
        },
      });

      const sub = await prisma.subKoordinatorBidang.create({
        data: {
          userId: user.id,
          nama,
          bidangId,
        },
      });

      res.status(201).json({
        status: true,
        message: 'Akun Sub Koordinator berhasil dibuat',
        data: { user, sub },
      });
    } catch (error) {
      next(error);
    }
  },

  updateSubKoordinator: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { email, password, nama, bidangId } = req.body;

      // Cari data sub koordinator
      const sub = await prisma.subKoordinatorBidang.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!sub) {
        return res.status(404).json({
          status: false,
          message: 'Sub Koordinator tidak ditemukan',
          data: null,
        });
      }

      // Cek apakah email baru sudah digunakan user lain
      if (email && email !== sub.user.email) {
        const emailUsed = await prisma.user.findUnique({ where: { email } });
        if (emailUsed) {
          return res.status(409).json({
            status: false,
            message: 'Email sudah digunakan oleh akun lain',
            data: null,
          });
        }
      }

      // Update data user (jika ada perubahan)
      await prisma.user.update({
        where: { id: sub.userId },
        data: {
          email: email || sub.user.email,
          password: password
            ? await bcrypt.hash(password, 10)
            : sub.user.password,
        },
      });

      // Update data sub koordinator
      const updatedSub = await prisma.subKoordinatorBidang.update({
        where: { id },
        data: {
          nama: nama || sub.nama,
          bidangId: bidangId || sub.bidangId,
        },
        include: { user: true, bidang: true },
      });

      return res.status(200).json({
        status: true,
        message: 'Akun Sub Koordinator berhasil diperbarui',
        data: updatedSub,
      });
    } catch (error) {
      next(error);
    }
  },

  approvePesertaMagang: async (req, res, next) => {
    try {
      const { id } = req.params;

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Peserta magang tidak ditemukan',
        });
      }

      if (peserta.status === 'APPROVED') {
        return res.status(400).json({
          status: false,
          message: 'Peserta sudah disetujui sebelumnya',
        });
      }

      // Update status jadi APPROVED
      await prisma.pesertaMagang.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      // Simpan notifikasi
      await prisma.notifikasi.create({
        data: {
          userId: peserta.userId,
          tipe: 'registrasi',
          judul: 'Registrasi Disetujui',
          pesan: 'Selamat! Registrasi akun magang Kamu telah disetujui.',
        },
      });

      // Render template approveAccount.ejs
      const templatePath = path.join(__dirname, '../views/approveAccount.ejs');
      const html = await ejs.renderFile(templatePath, {
        nama: peserta.namaLengkap,
        email: peserta.user.email,
      });

      // Kirim email
      await sendEmail({
        from: process.env.EMAIL_USER,
        to: peserta.user.email,
        subject: 'Registrasi Magang Disetujui',
        html, // pakai template yang dirender
      });

      return res.status(200).json({
        status: true,
        message: 'Peserta magang berhasil disetujui & email terkirim',
        data: { id: peserta.id, nama: peserta.namaLengkap },
      });
    } catch (error) {
      next(error);
    }
  },

  rejectPesertaMagang: async (req, res, next) => {
    try {
      const { id } = req.params;

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Peserta magang tidak ditemukan',
        });
      }

      if (peserta.status === 'REJECTED') {
        return res.status(400).json({
          status: false,
          message: 'Peserta sudah ditolak sebelumnya',
        });
      }

      // Update status jadi REJECTED
      await prisma.pesertaMagang.update({
        where: { id },
        data: { status: 'REJECTED' },
      });

      // Simpan notifikasi
      await prisma.notifikasi.create({
        data: {
          userId: peserta.userId,
          tipe: 'registrasi',
          judul: 'Registrasi Ditolak',
          pesan:
            'Maaf, registrasi akun magang Kamu ditolak. Silakan hubungi admin.',
        },
      });

      // Render template rejectAccount.ejs
      const templatePath = path.join(__dirname, '../views/rejectAccount.ejs');
      const html = await ejs.renderFile(templatePath, {
        nama: peserta.namaLengkap,
        email: peserta.user.email,
      });

      // Kirim email
      await sendEmail({
        from: process.env.EMAIL_USER,
        to: peserta.user.email,
        subject: 'Registrasi Magang Ditolak',
        html, // pakai template yang dirender
      });

      return res.status(200).json({
        status: true,
        message: 'Peserta magang berhasil ditolak & email terkirim',
        data: { id: peserta.id, nama: peserta.namaLengkap },
      });
    } catch (error) {
      next(error);
    }
  },

  // ✅ Daftar peserta magang dengan status PENDING
  getPendingPesertaMagang: async (req, res) => {
    try {
      const pendingPeserta = await prisma.pesertaMagang.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' }, // urutkan dari terbaru
        include: { user: true },
      });

      res.json({
        success: true,
        message: 'Daftar peserta magang menunggu persetujuan',
        data: pendingPeserta,
      });
    } catch (error) {
      console.error('Error getPendingPesertaMagang:', error);
      res
        .status(500)
        .json({ success: false, message: 'Internal server error' });
    }
  },

  // ✅ History peserta magang (APPROVED & REJECTED)
  getHistoryPesertaMagang: async (req, res) => {
    try {
      const historyPeserta = await prisma.pesertaMagang.findMany({
        where: {
          OR: [{ status: 'APPROVED' }, { status: 'REJECTED' }],
        },
        orderBy: { updatedAt: 'desc' },
        include: { user: true },
      });

      res.json({
        success: true,
        message: 'History persetujuan peserta magang',
        data: historyPeserta,
      });
    } catch (error) {
      console.error('Error getHistoryPesertaMagang:', error);
      res
        .status(500)
        .json({ success: false, message: 'Internal server error' });
    }
  },

  createKuotaBidang: async (req, res, next) => {
    try {
      const { nama, kuota } = req.body;

      // Validasi input
      if (!nama || kuota == null) {
        return res.status(400).json({
          status: false,
          message: 'Nama dan kuota wajib diisi',
          data: null,
        });
      }

      // Cek apakah bidang dengan nama yang sama sudah ada
      const existing = await prisma.kuotaBidang.findFirst({ where: { nama } });
      if (existing) {
        return res.status(409).json({
          status: false,
          message: 'Nama bidang sudah terdaftar',
          data: null,
        });
      }

      // Simpan ke database
      const bidang = await prisma.kuotaBidang.create({
        data: {
          nama,
          kuota: parseInt(kuota),
        },
      });

      return res.status(201).json({
        status: true,
        message: 'Bidang berhasil dibuat',
        data: bidang,
      });
    } catch (error) {
      next(error);
    }
  },

  updateKuotaBidang: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nama, kuota } = req.body;

      // Validasi input
      if (!nama || kuota == null) {
        return res.status(400).json({
          status: false,
          message: 'Nama dan kuota wajib diisi',
          data: null,
        });
      }

      // Cek apakah bidang dengan ID tersebut ada
      const existing = await prisma.kuotaBidang.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          status: false,
          message: 'Bidang tidak ditemukan',
          data: null,
        });
      }

      // Update bidang
      const updated = await prisma.kuotaBidang.update({
        where: { id },
        data: {
          nama,
          kuota: parseInt(kuota),
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Kuota bidang berhasil diperbarui',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteUser: async (req, res, next) => {
    try {
      const id = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({
          status: false,
          message: 'User tidak ditemukan',
          data: null,
        });
      }

      // Hapus relasi pesertaMagang jika ada
      await prisma.pesertaMagang.deleteMany({ where: { userId: id } });

      // Hapus relasi subKoordinatorBidang jika ada
      await prisma.subKoordinatorBidang.deleteMany({ where: { userId: id } });

      // Hapus relasi admin jika ada
      await prisma.admin.deleteMany({ where: { userId: id } });

      // Hapus notifikasi
      await prisma.notifikasi.deleteMany({ where: { userId: id } });

      // Hapus user
      await prisma.user.delete({ where: { id } });

      return res.status(200).json({
        status: true,
        message: 'Akun berhasil dihapus',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },

  // Ambil semua user
  getAllUsers: async (req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        include: {
          pesertaMagang: true,
          subKoordinatorBidang: true,
          admin: true,
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Data user berhasil diambil',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  },

  // Ambil user berdasarkan ID
  getUserById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          pesertaMagang: true,
          subKoordinatorBidang: true,
          admin: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          status: false,
          message: `User dengan ID ${id} tidak ditemukan`,
          data: null,
        });
      }

      return res.status(200).json({
        status: true,
        message: 'Data user berhasil diambil',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  // Ambil user berdasarkan token
  getUserByToken: async (req, res, next) => {
    try {
      const { id } = req.user;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          pesertaMagang: true,
          subKoordinatorBidang: true,
          admin: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          status: false,
          message: 'User tidak ditemukan',
          data: null,
        });
      }

      return res.status(200).json({
        status: true,
        message: 'Profil user berhasil diambil',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllPesertaMagang: async (req, res, next) => {
    try {
      const pesertaMagang = await prisma.pesertaMagang.findMany({
        include: {
          user: {
            select: {
              email: true,
              role: true,
            },
          },
          bidang: {
            select: {
              nama: true,
              kuota: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Daftar semua peserta magang berhasil diambil',
        data: pesertaMagang,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllSubKoordinatorBidang: async (req, res, next) => {
    try {
      const subkoordinators = await prisma.subKoordinatorBidang.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          bidang: {
            select: {
              id: true,
              nama: true,
              kuota: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Daftar semua sub koordinator bidang berhasil diambil',
        data: subkoordinators,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllKritikSaran: async (req, res, next) => {
    try {
      const kritikSaran = await prisma.kritikSaran.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nama: true,
          email: true,
          pesan: true,
          createdAt: true,
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Daftar kritik dan saran berhasil diambil',
        data: kritikSaran,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllLogbookPeserta: async (req, res, next) => {
    try {
      const logbooks = await prisma.logbook.findMany({
        orderBy: { tanggal: 'desc' },
        include: {
          peserta: {
            select: {
              id: true,
              namaLengkap: true,
              nimNis: true,
              instansi: true,
              jurusan: true,
              bidang: {
                select: {
                  id: true,
                  nama: true,
                },
              },
            },
          },
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Data logbook peserta magang berhasil diambil',
        data: logbooks,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllLaporanHasilMagang: async (req, res, next) => {
    try {
      const laporan = await prisma.laporanHasilMagang.findMany({
        include: {
          peserta: {
            select: {
              namaLengkap: true,
              nimNis: true,
              instansi: true,
              jurusan: true,
              user: {
                select: {
                  email: true,
                },
              },
              ajuan: {
                select: {
                  bidang: {
                    select: {
                      nama: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1, // Ambil ajuan terbaru (jika ada lebih dari satu)
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Tambahkan nama bidang ke root data
      const formatted = laporan.map((item) => ({
        id: item.id,
        fileLaporan: item.fileLaporan,
        createdAt: item.createdAt,
        peserta: {
          namaLengkap: item.peserta.namaLengkap,
          nimNis: item.peserta.nimNis,
          instansi: item.peserta.instansi,
          jurusan: item.peserta.jurusan,
          email: item.peserta.user.email,
          bidang:
            item.peserta.ajuan[0]?.bidang?.nama || 'Nama bidang tidak ada',
        },
      }));

      return res.status(200).json({
        status: true,
        message: 'Data laporan hasil magang berhasil diambil',
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllUlasanMagang: async (req, res, next) => {
    try {
      const ulasanMagang = await prisma.ulasanMagang.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              pesertaMagang: {
                select: {
                  namaLengkap: true,
                  nimNis: true,
                  instansi: true,
                  jurusan: true,
                  ajuan: {
                    orderBy: {
                      createdAt: 'desc',
                    },
                    take: 1,
                    include: {
                      bidang: {
                        select: { nama: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const formatted = ulasanMagang.map((item) => {
        const peserta = item.user.pesertaMagang;
        const bidang =
          peserta?.ajuan?.[0]?.bidang?.nama ?? 'Nama bidang tidak tersedia';

        return {
          id: item.id,
          ulasan: item.ulasan,
          rating: item.rating,
          createdAt: item.createdAt,
          peserta: {
            namaLengkap: peserta?.namaLengkap || 'Nama lengkap tidak tersedia',
            nimNis: peserta?.nimNis || 'Nim/Nis tidak tersedia',
            instansi: peserta?.instansi || 'Instansi tidak tersedia',
            jurusan: peserta?.jurusan || 'Jurusan tidak tersedia',
            email: item.user.email,
            bidang,
          },
        };
      });

      return res.status(200).json({
        status: true,
        message: 'Data ulasan magang berhasil diambil',
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  },
};
