const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

module.exports = {
  // Create Sub Koordinator Akun
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

      // Cek email unik
      const existEmail = await prisma.user.findUnique({ where: { email } });
      if (existEmail) {
        return res.status(409).json({
          status: false,
          message: 'Email sudah digunakan',
          data: null,
        });
      }

      // Cek nama unik
      const existNama = await prisma.subKoordinatorBidang.findFirst({
        where: { nama },
      });
      if (existNama) {
        return res.status(409).json({
          status: false,
          message: 'Nama Sub Koordinator sudah digunakan',
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
        include: { bidang: true },
      });

      res.status(201).json({
        status: true,
        message: 'Akun Sub Koordinator berhasil dibuat',
        data: { user, sub },
      });
    } catch (error) {
      console.error(error);
      next(error);
    }
  },
  
  // GET semua sub koordinator (hanya name, email, bidang)
  getAllSubkoorbid: async (req, res, next) => {
    try {
      const subs = await prisma.subKoordinatorBidang.findMany({
        include: {
          user: { select: { id: true, email: true } },
          bidang: { select: { id: true, nama: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const result = subs.map((s) => ({
        id: s.id, // id dari tabel SubKoordinatorBidang
        userId: s.userId,
        nama: s.nama,
        email: s.user?.email || null,
        bidang: s.bidang ? { id: s.bidang.id, nama: s.bidang.nama } : null,
      }));

      return res.status(200).json({
        status: true,
        message: 'Data semua sub koordinator berhasil diambil',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // GET sub koordinator by ID (sub.id)
  getSubkoorbidById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const sub = await prisma.subKoordinatorBidang.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true } },
          bidang: { select: { id: true, nama: true } },
        },
      });

      if (!sub) {
        return res.status(404).json({
          status: false,
          message: 'Sub koordinator tidak ditemukan',
          data: null,
        });
      }

      const result = {
        id: sub.id,
        userId: sub.userId,
        nama: sub.nama,
        email: sub.user?.email || null,
        bidang: sub.bidang
          ? { id: sub.bidang.id, nama: sub.bidang.nama }
          : null,
      };

      return res.status(200).json({
        status: true,
        message: 'Detail sub koordinator berhasil diambil',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // UPDATE sub koordinator (admin bisa update siapa saja, sub koor hanya bisa update dirinya)
  updateProfileSubKoordinator: async (req, res, next) => {
    try {
      const { id } = req.params; // id = sub.id (SubKoordinatorBidang.id)
      const { nama, email, password, bidangId } = req.body;
      const requester = req.user; // dari middleware restrict (decoded token contains id and role)

      // Cari sub koordinator by id
      const sub = await prisma.subKoordinatorBidang.findUnique({
        where: { id },
        include: { user: true, bidang: true },
      });

      if (!sub) {
        return res.status(404).json({
          status: false,
          message: 'Sub koordinator tidak ditemukan',
          data: null,
        });
      }

      // Hak akses:
      // - admin => boleh update siapa saja
      // - sub_koordinator_bidang => hanya boleh update dirinya sendiri (requester.id === sub.userId)
      if (requester.role === 'admin') {
        // ok
      } else if (requester.role === 'sub_koordinator_bidang') {
        if (requester.id !== sub.userId) {
          return res.status(403).json({
            status: false,
            message: 'Tidak boleh mengubah data sub koordinator lain',
            data: null,
          });
        }
      } else {
        return res
          .status(403)
          .json({ status: false, message: 'Akses ditolak', data: null });
      }

      // Validasi email unik jika diubah
      if (email && email !== sub.user.email) {
        const emailExist = await prisma.user.findUnique({ where: { email } });
        if (emailExist) {
          return res.status(409).json({
            status: false,
            message: 'Email sudah digunakan',
            data: null,
          });
        }
      }

      // Update user (email, password) using sub.userId
      await prisma.user.update({
        where: { id: sub.userId },
        data: {
          email: email || sub.user.email,
          password: password
            ? await bcrypt.hash(password, 10)
            : sub.user.password,
        },
      });

      // Update sub koordinator (nama, bidang jika admin)
      const updated = await prisma.subKoordinatorBidang.update({
        where: { id },
        data: {
          nama: nama || sub.nama,
          bidangId:
            requester.role === 'admin'
              ? bidangId || sub.bidangId
              : sub.bidangId,
        },
        include: { bidang: true, user: true },
      });

      const result = {
        id: updated.id,
        userId: updated.userId,
        nama: updated.nama,
        email: updated.user?.email || null,
        bidang: updated.bidang
          ? { id: updated.bidang.id, nama: updated.bidang.nama }
          : null,
      };

      return res.status(200).json({
        status: true,
        message: 'Profil sub koordinator berhasil diperbarui',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // DELETE subkoordinator by sub.id
  deleteSubkoorbidById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const sub = await prisma.subKoordinatorBidang.findUnique({
        where: { id },
      });
      if (!sub) {
        return res.status(404).json({
          status: false,
          message: 'Sub koordinator tidak ditemukan',
          data: null,
        });
      }

      // Hapus user (cascade akan hapus subKoordinator record jika onDelete Cascade di schema)
      await prisma.user.delete({ where: { id: sub.userId } });

      return res.status(200).json({
        status: true,
        message: 'Sub koordinator berhasil dihapus',
        data: { id: sub.id, userId: sub.userId },
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
