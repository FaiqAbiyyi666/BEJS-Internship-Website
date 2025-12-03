const jwt = require('jsonwebtoken');
const { PrismaClient, Role, StatusPeserta } = require('@prisma/client');
const prisma = new PrismaClient();

const formatPrismaDate = (dateObj) => {
  if (!dateObj) return null;
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function _getStatusMagang(ajuan, today) {
  if (!ajuan) return 'Belum Mengajukan Magang';

  if (ajuan.statusUsulan === 'APPROVED') {
    const tglMulai = new Date(ajuan.tglMulai);
    const tglSelesai = new Date(ajuan.tglSelesai);
    tglMulai.setHours(0, 0, 0, 0);
    tglSelesai.setHours(0, 0, 0, 0);

    if (today > tglSelesai) return 'Selesai Magang';
    if (today >= tglMulai && today <= tglSelesai) return 'Aktif Magang';
    if (today < tglMulai) return 'Disetujui (Belum Mulai)';
  }
  return ajuan.statusUsulan === 'PENDING'
    ? 'Menunggu Persetujuan'
    : 'Ajuan Ditolak';
}

// Fungsi ini HANYA menentukan status surat
function _getStatusSurat(ajuan) {
  if (!ajuan) return 'Belum Mengajukan Magang';
  if (ajuan.suratPenerimaan) return 'Sudah Dikirim';
  if (ajuan.statusUsulan === 'APPROVED') return 'Surat Perlu Dikirim';
  if (ajuan.statusUsulan === 'PENDING')
    return 'Menunggu Persetujuan Ajuan Magang';
  if (ajuan.statusUsulan === 'REJECTED') return 'Ajuan Ditolak';
  return 'Belum Mengajukan Magang';
}

// Fungsi ini HANYA menentukan status sertifikat
function _getStatusSertifikat(ajuan, today, statusMagang) {
  if (!ajuan) return 'Belum Mengajukan Magang';
  if (ajuan.sertifikat) return 'Sudah Dikirim'; // Perlu 'statusMagang' agar tahu kapan dia selesai
  if (statusMagang === 'Selesai Magang') return 'Perlu Dikirim';
  return 'Belum Diterbitkan';
}

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
        tglLahir: formatPrismaDate(peserta.tglLahir),
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
          instagram: user.pesertaMagang?.instagram || null,
          tglLahir: formatPrismaDate(user.pesertaMagang?.tglLahir) || null,
          noTelepon: user.pesertaMagang?.noTelepon || null,
          nik: user.pesertaMagang?.nik || null,
          alamat: user.pesertaMagang?.alamat || null,
          foto: user.pesertaMagang?.pasFoto || null,
          ktp: user.pesertaMagang?.ktp || null,
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
      const {
        namaLengkap,
        noTelepon,
        nimNis,
        instansi,
        jurusan,
        alamat,
        instagram,
      } = req.body;

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

      if (!namaLengkap || !noTelepon || !instagram || !alamat) {
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
        nimNis: nimNis || null,
        instansi: instansi || null,
        jurusan: jurusan || null,
        instagram,
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const users = await prisma.user.findMany({
        where: {
          role: Role.peserta_magang,
          pesertaMagang: {
            status: 'APPROVED',
          },
        },
        include: {
          pesertaMagang: {
            include: {
              ajuan: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                  bidang: {
                    select: { nama: true, id: true },
                  },
                  sertifikat: true,
                  suratPenerimaan: true,
                  logbook: {
                    orderBy: { tanggal: 'asc' },
                  },
                  laporan: true,
                },
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
          profile.ajuan && profile.ajuan.length > 0 ? profile.ajuan[0] : null;

        const statusMagang = _getStatusMagang(ajuan, today);
        const statusSuratMagang = _getStatusSurat(ajuan);
        const statusSertifikat = _getStatusSertifikat(
          ajuan,
          today,
          statusMagang
        );

        const bidang = ajuan?.bidang || {};
        const flatLogbook = (ajuan?.logbook || []).map((entry) => ({
          id: entry.id,
          tanggal: formatPrismaDate(entry.tanggal),
          isi: entry.deskripsi || '',
          done: entry.deskripsi ? entry.deskripsi.trim().length > 0 : false,
        }));

        let laporanAkhirData = null;
        if (ajuan && ajuan.laporan) {
          laporanAkhirData = {
            status: ajuan.laporan.status,
            catatan: ajuan.laporan.catatan,
            fileUrl: ajuan.laporan.fileLaporan,
          };
        }

        let sertifikatData = null;
        if (ajuan && ajuan.sertifikat) {
          sertifikatData = {
            noSertifikat: ajuan.sertifikat.noSertifikat,
            nilai: ajuan.sertifikat.nilai,
            fileUrl: ajuan.sertifikat.fileUrl,
          };
        }

        return {
          id: user.id,
          foto: profile.pasFoto || '/default-profile.png',
          ktp: profile.ktp || '/default-profile.png',
          nama: profile.namaLengkap || 'Peserta Baru (Belum Isi Profil)',
          nim: profile.nimNis || null,
          email: user.email,
          instansi: profile.instansi || ajuan?.instansi || null,
          jurusan: profile.jurusan || ajuan?.jurusan || null,
          noTelepon: profile.noTelepon || null,
          nik: profile.nik || null,
          alamat: profile.alamat || null,
          instagram: profile.instagram || null,
          tglLahir: formatPrismaDate(profile.tglLahir) || null,
          bidang: bidang.nama || 'Belum Mendaftar Bidang',
          periodeMulai: formatPrismaDate(ajuan?.tglMulai) || '-',
          periodeSelesai: formatPrismaDate(ajuan?.tglSelesai) || '-',
          suratMagang: statusSuratMagang,
          statusMagang: statusMagang,
          sertifikat: statusSertifikat,
          logbook: flatLogbook,
          laporanAkhir: laporanAkhirData,
          sertifikatData: sertifikatData,

          bidangId: bidang.id || null,
          ajuanId: ajuan?.id || null,
        };
      });
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
