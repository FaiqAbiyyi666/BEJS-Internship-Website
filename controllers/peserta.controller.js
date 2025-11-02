const jwt = require('jsonwebtoken');
const { PrismaClient, Role } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');

module.exports = {
  getAuthenticatedUserProfile: async (req, res, next) => {
    try {
      const { id } = req.user;

      const peserta = await prisma.pesertaMagang.findFirst({
        where: { userId: id },
        include: {
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

      const profileData = {
        ...peserta,
        email: peserta.user.email,
        role: peserta.user.role,
      };
      delete profileData.user;

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
          nimNis: user.pesertaMagang?.nimNis || null,
          jurusan: user.pesertaMagang?.jurusan || null,
          instansi: user.pesertaMagang?.instansi || null,
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
      const { id } = req.user;
      const { namaLengkap, noTelepon, nimNis, instansi, jurusan, alamat } =
        req.body;

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
      const phoneRegex = /^0[8]\d{8,11}$/;
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

      const dataToUpdate = {
        namaLengkap,
        noTelepon,
        nimNis,
        instansi,
        jurusan,
        alamat,
      };

      if (req.body.pasFotoUrl) {
        dataToUpdate.pasFoto = req.body.pasFotoUrl;
      }

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

  getAllPesertaMagang: async (req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          role: Role.peserta_magang,
        },
        include: {
          pesertaMagang: {
            include: {
              ajuan: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                  bidang: {
                    select: { nama: true },
                  },
                },
              },
              sertifikat: {
                take: 1,
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!users || users.length === 0) {
        return res.status(200).json({
          status: true,
          message: 'Belum ada data peserta magang.',
          data: [],
        });
      }

      const allPeserta = users.map((user) => {
        const profile = user.pesertaMagang || {};
        const ajuan =
          profile.ajuan && profile.ajuan.length > 0 ? profile.ajuan[0] : {};
        const bidang = ajuan.bidang || {};
        const sertifikat = profile.sertifikat && profile.sertifikat.length > 0;

        return {
          id: user.id,
          foto: profile.pasFoto || '/default-profile.png',
          nama: profile.namaLengkap || 'Peserta Baru (Belum Isi Profil)',
          nim: profile.nimNis || null,
          email: user.email,
          instansi: profile.instansi || null,
          jurusan: profile.jurusan || null,
          noTelepon: profile.noTelepon || null,
          nik: profile.nik || null,
          alamat: profile.alamat || null,
          tglLahir: profile.tglLahir || null,
          bidang: bidang.nama || 'Belum Mendaftar Bidang',
          periodeMulai: ajuan.tglMulai || '-',
          periodeSelesai: ajuan.tglSelesai || '-',
          suratMagang: ajuan.statusUsulan || 'Perlu Dikirim',
          statusMagang: profile.status || 'N/A',
          sertifikat: sertifikat ? 'Sudah Diterbitkan' : 'Belum Diterbitkan',

          bidangId: bidang.id || null,
          ajuanId: ajuan.id || null,
        };
      }); // -------------------------
      return res.status(200).json({
        status: true,
        message: 'Berhasil mengambil semua data peserta magang.',
        data: allPeserta,
      });
    } catch (error) {
      console.error('Error di getAllPesertaMagang:', error);
      next(error);
    }
  },
};
