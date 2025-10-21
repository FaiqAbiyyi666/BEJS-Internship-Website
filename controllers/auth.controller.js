const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET_KEY;
const ejs = require('ejs');
const path = require('path');
const sendMail = require('../utils/sendEmail');
const getRenderedHtml = require('../utils/getRenderedHtml');

module.exports = {
  register: async (req, res, next) => {
    try {
      const {
        namaLengkap,
        tglLahir,
        email,
        password,
        role,
        noTelepon,
        nik,
        nimNis,
        instansi,
        jurusan,
        alamat,
      } = req.body;

      const pasFotoUrl = req.body.pas_foto_url;

      let parsedTglLahir = null;
      if (tglLahir) {
        parsedTglLahir = new Date(tglLahir);
        if (isNaN(parsedTglLahir)) {
          return res.status(400).json({
            message: 'Format tanggal lahir tidak valid (gunakan YYYY-MM-DD)',
          });
        }
      }

      // Validasi input
      if (
        !namaLengkap ||
        !tglLahir ||
        !email ||
        !password ||
        !noTelepon ||
        !nik ||
        !nimNis ||
        !instansi ||
        !jurusan ||
        !alamat ||
        !pasFotoUrl
      ) {
        return res.status(400).json({
          status: false,
          message: 'Semua field wajib diisi, termasuk pas foto',
          data: null,
        });
      }

      // Cek email sudah digunakan atau belum
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          status: false,
          message: 'Email sudah digunakan',
          data: null,
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Buat akun user
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role || 'peserta_magang',
        },
      });

      // Buat data peserta magang, dengan status PENDING
      let user = await prisma.pesertaMagang.create({
        data: {
          userId: newUser.id,
          namaLengkap,
          tglLahir: parsedTglLahir,
          noTelepon,
          nik,
          nimNis,
          instansi,
          jurusan,
          alamat,
          // --- PERBAIKAN ---
          // GANTI 'isApproved: false' MENJADI 'status: 'PENDING''
          status: 'PENDING', // Set status awal sebagai PENDING
          pasFoto: pasFotoUrl,
        },
      });

      // Render EJS template
      const htmlEmail = await ejs.renderFile(
        path.join(__dirname, '../views/registerSuccess.ejs'),
        { namaLengkap }
      );

      // Kirim email ke user
      await sendMail({
        from: process.env.SENDER_GMAIL,
        to: email,
        subject: 'Registrasi Berhasil - SIMAGANG Diskominfo Sidoarjo',
        html: htmlEmail,
      });

      return res.status(201).json({
        status: true,
        message: 'Registrasi berhasil. Menunggu persetujuan admin.',
        data: user,
      });
    } catch (error) {
      // Log error asli ke konsol server untuk debugging
      console.error('REGISTRATION ERROR:', error);
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server',
        // Kirim pesan error asli ke front-end (opsional, bagus untuk development)
        error: error.message,
      });
    }
  },

  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: false,
          message: 'Email dan password wajib diisi',
          data: null,
        });
      }

      // Cari user berdasarkan email
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          pesertaMagang: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          status: false,
          message: 'Email tidak terdaftar',
          data: null,
        });
      }

      // Cek password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({
          status: false,
          message: 'Password salah',
          data: null,
        });
      }

      // Buat token JWT
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: '1d' } // token berlaku 1 hari
      );

      return res.status(200).json({
        status: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            namaLengkap: user.pesertaMagang?.namaLengkap || null,
            foto: user.pesertaMagang?.pasFoto || null,
          },
        },
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
        select: {
          id: true,
          pesertaMagang: {
            // Ambil relasi pesertaMagang
            select: {
              namaLengkap: true, // Ambil nama lengkapnya
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          status: false,
          message: 'Email tidak ditemukan',
          data: null,
        });
      }

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, {
        expiresIn: '10m',
      });

      const resetUrl = `${process.env.CLIENT_BASE_URL}/reset-password?token=${token}`;
      const html = getRenderedHtml('resetPasswordEmail', {
        name: user.pesertaMagang?.namaLengkap || email, // Kirim nama ke EJS
        resetPasswordUrl: resetUrl,
      });

      await sendMail({
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

      jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
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
