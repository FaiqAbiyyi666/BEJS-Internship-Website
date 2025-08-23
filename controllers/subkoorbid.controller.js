const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

module.exports = {
  updateProfileSubKoordinator: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { nama, email, password, bidangId } = req.body;

      // Cek user dan pastikan role sesuai
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'sub_koordinator_bidang') {
        return res.status(403).json({
          status: false,
          message: 'Akses ditolak',
          data: null,
        });
      }

      // Cek sub koordinator
      const sub = await prisma.subKoordinatorBidang.findUnique({
        where: { userId },
      });

      if (!sub) {
        return res.status(404).json({
          status: false,
          message: 'Data sub koordinator tidak ditemukan',
          data: null,
        });
      }

      // Tidak boleh mengubah bidang
      if (bidangId && bidangId !== sub.bidangId) {
        return res.status(400).json({
          status: false,
          message: 'Tidak diperbolehkan mengubah bidang',
          data: null,
        });
      }

      // Validasi email jika diubah
      if (email && email !== user.email) {
        const emailExist = await prisma.user.findUnique({ where: { email } });
        if (emailExist) {
          return res.status(409).json({
            status: false,
            message: 'Email sudah digunakan',
            data: null,
          });
        }
      }

      // Update data user
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: email || user.email,
          password: password ? await bcrypt.hash(password, 10) : user.password,
        },
      });

      // Update data sub koordinator (hanya nama)
      const updated = await prisma.subKoordinatorBidang.update({
        where: { userId },
        data: {
          nama: nama || sub.nama,
        },
        include: {
          bidang: true,
          user: true,
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Profil sub koordinator berhasil diperbarui',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  updateKuotaBidang: async (req, res, next) => {
    try {
      const userId = req.user.id; // dari token login
      const { kuota } = req.body;

      if (kuota == null || isNaN(kuota) || kuota < 0) {
        return res.status(400).json({
          status: false,
          message: 'Kuota harus berupa angka dan tidak boleh negatif',
          data: null,
        });
      }

      // Cari data sub koordinator dan bidangnya
      const subKoordinator = await prisma.subKoordinatorBidang.findUnique({
        where: { userId },
      });

      if (!subKoordinator) {
        return res.status(403).json({
          status: false,
          message: 'Akses ditolak. Anda bukan sub koordinator bidang.',
          data: null,
        });
      }

      const bidangId = subKoordinator.bidangId;

      // Update kuota hanya pada bidang miliknya
      const updatedBidang = await prisma.kuotaBidang.update({
        where: { id: bidangId },
        data: { kuota: parseInt(kuota) },
      });

      return res.status(200).json({
        status: true,
        message: 'Kuota magang berhasil diperbarui',
        data: updatedBidang,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllPesertaMagang: async (req, res, next) => {
    try {
      const subKoordinatorId = req.user.id; // Ambil ID user dari token

      // Cek apakah user adalah sub koordinator dan ambil bidangId-nya
      const subKoordinator = await prisma.subKoordinatorBidang.findUnique({
        where: { userId: subKoordinatorId },
      });

      if (!subKoordinator) {
        return res.status(403).json({
          status: false,
          message: 'Akses ditolak. Anda bukan sub koordinator bidang.',
          data: null,
        });
      }

      // Ambil semua peserta magang yang memiliki ajuan ke bidang sub koordinator
      const ajuan = await prisma.ajuanMagang.findMany({
        where: {
          bidangId: subKoordinator.bidangId,
          peserta: {
            isApproved: true, // Hanya peserta yang sudah disetujui
          },
        },
        include: {
          peserta: {
            include: {
              user: {
                select: { email: true, role: true },
              },
              bidang: {
                select: { nama: true },
              },
            },
          },
        },
      });

      const pesertaMagang = ajuan.map((item) => item.peserta);

      return res.status(200).json({
        status: true,
        message: 'Daftar peserta magang berdasarkan bidang berhasil diambil',
        data: pesertaMagang,
      });
    } catch (error) {
      next(error);
    }
  },

  getLogbookPeserta: async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Ambil data subkoordinator dan bidangnya
      const sub = await prisma.subKoordinatorBidang.findUnique({
        where: { userId },
        include: { bidang: true },
      });

      if (!sub) {
        return res.status(403).json({
          status: false,
          message: 'Akun sub koordinator tidak valid',
          data: null,
        });
      }

      // Ambil peserta yang berada di bidang yang sama
      const logbooks = await prisma.logbook.findMany({
        where: {
          peserta: {
            bidangId: sub.bidangId, // pastikan relasi ini ada di model pesertaMagang
          },
        },
        orderBy: { tanggal: 'desc' },
        include: {
          peserta: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
        },
      });

      const formatted = logbooks.map((log) => ({
        id: log.id,
        tanggal: log.tanggal,
        deskripsi: log.deskripsi,
        pesertaNama: log.peserta.namaLengkap,
        pesertaEmail: log.peserta.user.email,
        createdAt: log.createdAt,
      }));

      return res.status(200).json({
        status: true,
        message: 'Logbook peserta berhasil diambil berdasarkan bidang',
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  },

  getLaporanHasilMagangByBidang: async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Cari bidangId dari user yang login sebagai subkoordinator
      const subkoordinator = await prisma.subKoordinatorBidang.findUnique({
        where: { userId },
      });

      if (!subkoordinator) {
        return res.status(403).json({
          status: false,
          message: 'Akses ditolak. Anda bukan sub koordinator bidang.',
          data: null,
        });
      }

      const laporan = await prisma.laporanHasilMagang.findMany({
        include: {
          peserta: {
            include: {
              user: {
                select: {
                  email: true,
                },
              },
              ajuan: {
                where: {
                  bidangId: subkoordinator.bidangId,
                },
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
                include: {
                  bidang: {
                    select: {
                      nama: true,
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

      // Filter hanya yang punya ajuan sesuai bidang subkoordinator
      const filtered = laporan.filter((item) => item.peserta.ajuan.length > 0);

      const formatted = filtered.map((item) => ({
        id: item.id,
        fileLaporan: item.fileLaporan,
        createdAt: item.createdAt,
        peserta: {
          namaLengkap: item.peserta.namaLengkap,
          nimNis: item.peserta.nimNis,
          instansi: item.peserta.instansi,
          jurusan: item.peserta.jurusan,
          email: item.peserta.user.email,
          bidang: item.peserta.ajuan[0].bidang.nama,
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

  getUlasanMagangByBidang: async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Ambil data sub koordinator dan bidangnya
      const subKoordinator = await prisma.subKoordinatorBidang.findUnique({
        where: { userId },
      });

      if (!subKoordinator) {
        return res.status(403).json({
          status: false,
          message: 'Akses ditolak. Anda bukan sub koordinator bidang.',
          data: null,
        });
      }

      const bidangId = subKoordinator.bidangId;

      // Ambil ulasan dari peserta yang bidangnya sesuai
      const ulasanMagang = await prisma.ulasanMagang.findMany({
        include: {
          user: {
            select: {
              email: true,
              pesertaMagang: {
                select: {
                  namaLengkap: true,
                  nimNis: true,
                  instansi: true,
                  jurusan: true,
                  ajuan: {
                    where: { bidangId },
                    orderBy: { createdAt: 'desc' },
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

      const filtered = ulasanMagang.filter((item) => {
        const ajuan = item.user.pesertaMagang?.ajuan?.[0];
        return ajuan && ajuan.bidang?.nama;
      });

      const formatted = filtered.map((item) => {
        const peserta = item.user.pesertaMagang;
        const ajuan = peserta?.ajuan?.[0];
        const bidang = ajuan?.bidang?.nama || 'Nama bidang tidak tersedia';

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
        message: 'Ulasan magang berdasarkan bidang berhasil diambil',
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  },
  approveAjuanMagang: async (req, res, next) => {
    try {
      const userId = req.user.id; // ID subkoordinator dari token
      const { ajuanId } = req.params;

      // Cari subkoordinator dan bidangnya
      const subKoordinator = await prisma.subKoordinatorBidang.findUnique({
        where: { userId },
        include: { bidang: true },
      });

      if (!subKoordinator) {
        return res.status(403).json({
          status: false,
          message: 'Akses ditolak. Anda bukan sub koordinator bidang.',
          data: null,
        });
      }

      // Ambil data ajuan
      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        include: {
          peserta: true,
          bidang: true,
        },
      });

      if (!ajuan) {
        return res.status(404).json({
          status: false,
          message: 'Ajuan magang tidak ditemukan',
          data: null,
        });
      }

      // Pastikan bidang ajuan sama dengan bidang milik subkoordinator
      if (ajuan.bidangId !== subKoordinator.bidangId) {
        return res.status(403).json({
          status: false,
          message: 'Ajuan magang bukan untuk bidang Anda',
          data: null,
        });
      }

      // Pastikan status belum disetujui
      if (ajuan.statusUsulan === 'disetujui') {
        return res.status(400).json({
          status: false,
          message: 'Ajuan magang sudah disetujui sebelumnya',
          data: null,
        });
      }

      // Cek kuota bidang
      const kuotaBidang = await prisma.kuotaBidang.findUnique({
        where: { id: subKoordinator.bidangId },
      });

      if (!kuotaBidang || kuotaBidang.kuota <= 0) {
        return res.status(400).json({
          status: false,
          message: 'Kuota magang di bidang ini sudah habis',
          data: null,
        });
      }

      // Update status ajuan & relasikan bidang ke peserta, kurangi kuota
      const updatedAjuan = await prisma.ajuanMagang.update({
        where: { id: ajuanId },
        data: {
          statusUsulan: 'disetujui',
          peserta: {
            update: {
              bidangId: subKoordinator.bidangId,
            },
          },
        },
        include: {
          peserta: true,
          bidang: true,
        },
      });

      // Kurangi kuota bidang
      await prisma.kuotaBidang.update({
        where: { id: subKoordinator.bidangId },
        data: {
          kuota: { decrement: 1 },
        },
      });

      return res.status(200).json({
        status: true,
        message: `Ajuan magang disetujui untuk peserta ${updatedAjuan.peserta.namaLengkap}`,
        data: updatedAjuan,
      });
    } catch (error) {
      next(error);
    }
  },
};
