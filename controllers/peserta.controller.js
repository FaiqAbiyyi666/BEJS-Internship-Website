const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');

module.exports = {
  getAuthenticatedUserProfile: async (req, res, next) => {
    try {
      // Ambil ID pengguna dari token yang sudah diverifikasi oleh middleware 'restrict'
      const { id } = req.user;

      const peserta = await prisma.pesertaMagang.findFirst({
        where: { userId: id },
        include: {
          // Sertakan data dari tabel User untuk mendapatkan email
          user: {
            select: {
              email: true,
              role: true,
            },
          },
        },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Profil peserta magang tidak ditemukan',
          data: null,
        });
      }

      // Gabungkan data untuk respons yang lebih rapi
      const profileData = {
        ...peserta, // Ambil semua data dari PesertaMagang (namaLengkap, nik, dll)
        email: peserta.user.email, // Tambahkan email
        role: peserta.user.role, // Tambahkan role
      };
      delete profileData.user; // Hapus objek user yang bersarang

      return res.status(200).json({
        status: true,
        message: 'Berhasil mengambil data profil',
        data: profileData,
      });
    } catch (error) {
      next(error);
    }
  },

  getProfileById: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: { pesertaMagang: true },
      });

      if (!user) {
        return res
          .status(404)
          .json({ status: false, message: 'User tidak ditemukan' });
      }

      return res.json({
        status: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          namaLengkap: user.pesertaMagang?.namaLengkap || null,
          nimNis: user.pesertaMagang?.nimNis || null, // ✅ field sesuai schema
          jurusan: user.pesertaMagang?.jurusan || null,
          instansi: user.pesertaMagang?.instansi || null, // ✅ field sesuai schema
          tglLahir: user.pesertaMagang?.tglLahir || null,
          noTelepon: user.pesertaMagang?.noTelepon || null,
          nik: user.pesertaMagang?.nik || null,
          alamat: user.pesertaMagang?.alamat || null,
          foto: user.pesertaMagang?.pasFoto || null,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, message: 'Server error' });
    }
  },

  updateUserProfile: async (req, res, next) => {
    try {
      const { id } = req.user; // Diambil dari token oleh middleware otentikasi
      const { namaLengkap, noTelepon, nimNis, instansi, jurusan, alamat } =
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

      // --- VALIDASI INPUT ---
      if (
        !namaLengkap ||
        !noTelepon ||
        !nimNis ||
        !instansi ||
        !jurusan ||
        !alamat
      ) {
        return res.status(400).json({
          status: false,
          message: 'Semua kolom yang dapat diedit wajib diisi',
        });
      }
      const phoneRegex = /^0[8]\d{8,11}$/; // Regex umum untuk nomor HP Indonesia
      if (!phoneRegex.test(noTelepon)) {
        return res.status(400).json({
          status: false,
          message: 'Nomor telepon tidak valid (contoh: 081234567890)',
        });
      }
      if (!/^[a-zA-Z0-9]{10,12}$/.test(nimNis)) {
        return res.status(400).json({
          status: false,
          message: 'NIM/NIS harus terdiri dari 10 hingga 12 karakter',
        });
      }

      // Siapkan data yang akan diupdate
      const dataToUpdate = {
        namaLengkap,
        noTelepon,
        nimNis,
        instansi,
        jurusan,
        alamat,
      };

      // Cek apakah middleware uploadPasFoto menemukan URL foto baru dari ImageKit
      if (req.body.pasFotoUrl) {
        // Simpan URL dari ImageKit ke kolom database 'pasFoto'
        dataToUpdate.pasFoto = req.body.pasFotoUrl;
      }

      // Lakukan update data
      const updatedPeserta = await prisma.pesertaMagang.update({
        where: { id: peserta.id },
        data: dataToUpdate,
      });

      return res.status(200).json({
        status: true,
        message: 'Profil peserta magang berhasil diperbarui',
        data: updatedPeserta,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllDataMagang: async (req, res) => {
    try {
      // Ambil semua peserta magang
      // Kita juga menyertakan data 'user' terkait untuk mendapatkan email
      const allPeserta = await prisma.pesertaMagang.findMany({
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      }); // Kirim data sebagai respons

      res.status(200).json({
        status: true,
        message: 'Data semua peserta magang berhasil diambil',
        data: allPeserta,
      });
    } catch (error) {
      console.error('Error saat mengambil data magang:', error);
      res.status(500).json({ status: false, message: 'Server error' });
    }
  },
};
