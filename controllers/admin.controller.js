const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const sendMail = require('../utils/sendEmail');
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

  approvePesertaMagang: async (req, res, next) => {
    try {
      const { id } = req.params;

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { id: id },
        include: { user: true },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Peserta magang tidak ditemukan',
        });
      }

      if (peserta.status !== 'PENDING') {
        return res.status(400).json({
          status: false,
          message: `Peserta sudah dalam status ${peserta.status}, tidak dapat diubah.`,
        });
      }

      await prisma.pesertaMagang.update({
        where: { id: id },
        data: { status: 'APPROVED' },
      });

      await prisma.notifikasi.create({
        data: {
          userId: peserta.userId,
          tipe: 'registrasi',
          judul: 'Registrasi Disetujui',
          pesan:
            'Selamat! Registrasi akun magang Kamu telah disetujui oleh admin.',
        },
      });

      const templatePath = path.join(__dirname, '../views/approveAccount.ejs');
      const htmlEmail = await ejs.renderFile(templatePath, {
        namaLengkap: peserta.namaLengkap,
        email: peserta.user.email,
      });

      await sendMail({
        from: process.env.SENDER_GMAIL,
        to: peserta.user.email,
        subject: 'Registrasi Magang Disetujui - SIMAGANG Diskominfo Sidoarjo',
        html: htmlEmail,
      });

      return res.status(200).json({
        status: true,
        message:
          'Peserta magang berhasil disetujui & email notifikasi terkirim.',
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
        where: { id: id },
        include: { user: true },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Peserta magang tidak ditemukan',
        });
      }

      if (peserta.status !== 'PENDING') {
        return res.status(400).json({
          status: false,
          message: `Peserta sudah dalam status ${peserta.status}, tidak dapat diubah.`,
        });
      }

      await prisma.pesertaMagang.update({
        where: { id: id },
        data: { status: 'REJECTED' },
      });

      await prisma.notifikasi.create({
        data: {
          userId: peserta.userId,
          tipe: 'registrasi',
          judul: 'Registrasi Ditolak',
          pesan:
            'Maaf, registrasi akun magang Kamu ditolak. Silakan hubungi admin untuk informasi lebih lanjut.',
        },
      });

      const templatePath = path.join(__dirname, '../views/rejectAccount.ejs');
      const htmlEmail = await ejs.renderFile(templatePath, {
        namaLengkap: peserta.namaLengkap,
        email: peserta.user.email,
      });

      await sendMail({
        from: process.env.SENDER_GMAIL,
        to: peserta.user.email,
        subject: 'Registrasi Magang Ditolak - SIMAGANG Diskominfo Sidoarjo',
        html: htmlEmail,
      });

      return res.status(200).json({
        status: true,
        message: 'Peserta magang berhasil ditolak & email notifikasi terkirim.',
        data: { id: peserta.id, nama: peserta.namaLengkap },
      });
    } catch (error) {
      next(error);
    }
  },

  getPendingPesertaMagang: async (req, res) => {
    try {
      const pendingPeserta = await prisma.pesertaMagang.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
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

      await prisma.pesertaMagang.deleteMany({ where: { userId: id } });

      await prisma.subKoordinatorBidang.deleteMany({ where: { userId: id } });

      await prisma.admin.deleteMany({ where: { userId: id } });

      await prisma.notifikasi.deleteMany({ where: { userId: id } });

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

  getAllDataMagang: async (req, res, next) => {
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

  adminUpdatePesertaProfile: async (req, res, next) => {
    const { userId } = req.params;

    const {
      email,
      namaLengkap,
      nimNis,
      tglLahir,
      noTelepon,
      nik,
      alamat,
      instansi,
      jurusan,
      periodeMulai,
      periodeSelesai,
      bidangId,
      ajuanId,
    } = req.body;

    if (
      !email ||
      !namaLengkap ||
      !nimNis ||
      !tglLahir ||
      !noTelepon ||
      !nik ||
      !alamat ||
      !instansi ||
      !jurusan
    ) {
      return res.status(400).json({
        status: false,
        message:
          'Semua field data personal (Nama, NIM, Email, dll) wajib diisi.',
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { email: email },
        });

        const peserta = await tx.pesertaMagang.findFirst({
          where: { userId: userId },
          select: { id: true },
        });

        if (!peserta) {
          throw new Error(
            'Profil PesertaMagang tidak ditemukan untuk user ini.'
          );
        }

        await tx.pesertaMagang.update({
          where: { id: peserta.id },
          data: {
            namaLengkap,
            nimNis,
            tglLahir: new Date(tglLahir),
            noTelepon,
            nik,
            alamat,
            instansi,
            jurusan,
          },
        });

        if (ajuanId && periodeMulai && periodeSelesai && bidangId) {
          const ajuan = await tx.ajuanMagang.findUnique({
            where: { id: ajuanId },
          });

          if (ajuan) {
            await tx.ajuanMagang.update({
              where: { id: ajuanId },
              data: {
                tglMulai: new Date(periodeMulai),
                tglSelesai: new Date(periodeSelesai),
                bidangId: bidangId,
              },
            });
          }
        }
      });

      res.status(200).json({
        status: true,
        message: 'Data peserta berhasil diperbarui oleh Admin.',
      });
    } catch (error) {
      console.error('Error saat Admin update data peserta:', error);
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
                take: 1,
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

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
