const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');
const getRenderedHtml = require('../utils/getRenderedHtml');

module.exports = {
  updateUserProfile: async (req, res, next) => {
    try {
      const { id } = req.user;
      const { namaLengkap, noTelepon, nik, nimNis, instansi, jurusan, alamat } =
        req.body;

      // Cari data peserta berdasarkan userId
      const peserta = await prisma.pesertaMagang.findFirst({
        where: { userId: id },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Peserta magang tidak ditemukan',
          data: null,
        });
      }

      // Validasi nomor telepon
      const phoneRegex = /^0[2-9]\d{8,12}$/;
      if (!phoneRegex.test(noTelepon)) {
        return res.status(400).json({
          status: false,
          message:
            'Nomor telepon tidak valid (harus 10-13 digit dan diawali 0)',
          data: null,
        });
      }

      // Validasi NIK
      if (!/^\d{16}$/.test(nik)) {
        return res.status(400).json({
          status: false,
          message: 'NIK harus terdiri dari 16 digit angka',
          data: null,
        });
      }

      // Validasi NIM/NIS
      if (!/^[a-zA-Z0-9]{10,12}$/.test(nimNis)) {
        return res.status(400).json({
          status: false,
          message:
            'NIM/NIS harus terdiri dari 10 hingga 12 karakter huruf atau angka',
          data: null,
        });
      }

      // Lakukan update data
      const updated = await prisma.pesertaMagang.update({
        where: { id: peserta.id },
        data: {
          namaLengkap,
          tglLahir,
          noTelepon,
          nik,
          nimNis,
          instansi,
          jurusan,
          alamat,
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Profil peserta magang berhasil diperbarui',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  sendResetPasswordEmail: async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          status: false,
          message: 'Email wajib diisi',
          data: null,
        });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          status: false,
          message: 'Email tidak ditemukan',
          data: null,
        });
      }

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: '30m',
      });

      const resetUrl = `${process.env.CLIENT_BASE_URL}/reset-password?token=${token}`;
      const html = getRenderedHtml('resetPasswordEmail', {
        name: email,
        resetPasswordUrl: resetUrl,
      });

      await sendEmail({
        to: email,
        subject: 'Magang Diskominfo Sidoarjo - Konfirmasi Reset Password',
        html,
      });

      res.status(200).json({
        status: true,
        message: `Email reset password telah dikirim ke ${email}`,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },

  resetPassword: async (req, res, next) => {
    try {
      const { token } = req.query;
      const { password } = req.body;

      if (!token) {
        return res.status(400).json({
          status: false,
          message: 'Token tidak ditemukan',
          data: null,
        });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({
          status: false,
          message: 'Password minimal 6 karakter',
          data: null,
        });
      }

      jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
          return res.status(400).json({
            status: false,
            message:
              err.name === 'TokenExpiredError'
                ? 'Token sudah kadaluarsa'
                : `Token tidak valid: ${err.message}`,
            data: null,
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
        });
        if (!user) {
          return res.status(404).json({
            status: false,
            message: 'Pengguna tidak ditemukan',
            data: null,
          });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });

        return res.status(200).json({
          status: true,
          message: 'Password berhasil diubah',
          data: null,
        });
      });
    } catch (error) {
      next(error);
    }
  },
};
