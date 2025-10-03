const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET_KEY;
const ejs = require('ejs');
const path = require('path');
const sendMail = require('../utils/sendEmail');

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

      const pathFoto = req.file?.path;

      let parsedTglLahir = null;
      if (tglLahir) {
        parsedTglLahir = new Date(tglLahir); // ✅ convert dari string ke Date
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
        !pathFoto
      ) {
        return res.status(400).json({
          status: false,
          message: 'Semua field wajib diisi',
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

      // Buat data peserta magang, dengan status belum disetujui
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
          isApproved: false, // wajib persetujuan admin
          pasFoto: pathFoto || '',
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
      console.error(error);
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server',
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
};
