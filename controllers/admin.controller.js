const { PrismaClient } = require('@prisma/client');
const { Role, StatusPeserta } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const sendMail = require('../utils/sendEmail');
const { formatDate } = require('../utils/formatedDate');
const ejs = require('ejs');
const path = require('path');

module.exports = {
  createAdmin: async (req, res, next) => {
    try {
      const { email, password, nama, bidangId } = req.body;

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
          nama: nama,
          bidangId: bidangId,
        },
      });

      res.status(201).json({
        status: true,
        message: 'Akun admin berhasil dibuat',
        data: { user, admin },
      });
    } catch (error) {
      if (error.code === 'P2003') {
        return res.status(400).json({
          status: false,
          message: 'bidangId tidak valid atau tidak ditemukan',
          data: null,
        });
      }
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

  getHistoryPesertaMagang: async (req, res) => {
    try {
      const { search, date, status } = req.query;

      const whereClause = {
        status: {
          in: [StatusPeserta.APPROVED, StatusPeserta.REJECTED],
        },
      };

      if (status && status !== 'all') {
        if (status === 'APPROVED') {
          whereClause.status = StatusPeserta.APPROVED;
        } else if (status === 'REJECTED') {
          whereClause.status = StatusPeserta.REJECTED;
        }
      }

      if (date) {
        const startDate = new Date(date + 'T00:00:00');

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);

        whereClause.createdAt = {
          gte: startDate,
          lt: endDate,
        };
      }

      if (search) {
        whereClause.AND = [
          {
            OR: [
              { namaLengkap: { contains: search } },
              { nimNis: { contains: search } },
              { nik: { contains: search } },
              { instansi: { contains: search } },
              { jurusan: { contains: search } },
              { instagram: { contains: search } },
              { alamat: { contains: search } },
              {
                user: {
                  email: { contains: search },
                },
              },
            ],
          },
        ];
      }

      const historyPeserta = await prisma.pesertaMagang.findMany({
        where: whereClause,
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
      ajuanId,
      periodeMulai,
      periodeSelesai,
      bidangId,
    } = req.body;

    if (
      !email ||
      !namaLengkap ||
      !tglLahir ||
      !noTelepon ||
      !nik ||
      !alamat ||
      !nimNis
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

            await tx.pesertaMagang.update({
              where: { id: peserta.id },
              data: {
                bidangId: bidangId,
              },
            });
          } else {
            throw new Error('Data AjuanMagang tidak ditemukan.');
          }
        }
      });

      res.status(200).json({
        status: true,
        message: 'Data peserta berhasil diperbarui oleh Admin.',
      });
    } catch (error) {
      console.error('Error saat Admin update data peserta:', error);
      if (
        error.message.includes('PesertaMagang') ||
        error.message.includes('AjuanMagang')
      ) {
        return res.status(404).json({ status: false, message: error.message });
      }
      next(error);
    }
  },

  getAdminProfile: async (req, res) => {
    const userId = req.user.id;

    try {
      const admin = await prisma.admin.findUnique({
        where: {
          userId: userId,
        },
        include: {
          user: {
            select: {
              email: true,
              role: true,
            },
          },
          bidang: {
            select: {
              id: true,
              nama: true,
            },
          },
        },
      });

      if (!admin) {
        return res
          .status(404)
          .json({ message: 'Profil admin tidak ditemukan' });
      }

      const profileData = {
        nama: admin.nama,
        email: admin.user.email,
        role: admin.user.role,
        tanggalBergabung: admin.createdAt,
        bidang: admin.bidang
          ? { id: admin.bidang.id, nama: admin.bidang.nama }
          : null,
      };

      res.status(200).json(profileData);
    } catch (error) {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  },

  changeAdminPassword: async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ message: 'Password baru dan konfirmasi tidak cocok' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ message: 'User tidak ditemukan' });
      }

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Password lama salah' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      res.status(200).json({ message: 'Password berhasil diubah' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  },
};
