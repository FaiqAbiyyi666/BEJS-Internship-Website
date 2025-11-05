const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateWorkdays(startDate, endDate) {
  let count = 0;
  const currentDate = new Date(startDate.getTime());
  const lastDate = new Date(endDate.getTime());

  while (currentDate <= lastDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return count;
}

module.exports = {
  createUlasan: async (req, res, next) => {
    try {
      const { ulasan, rating } = req.body;

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message: 'Anda harus login untuk mengirim ulasan.',
          data: null,
        });
      }

      const userId = req.user.id;

      if (!ulasan || !rating) {
        return res.status(400).json({
          status: false,
          message: 'Ulasan dan rating wajib diisi.',
          data: null,
        });
      }

      const existingUlasan = await prisma.ulasanMagang.findFirst({
        where: { userId: userId },
      });

      if (existingUlasan) {
        return res.status(409).json({
          status: false,
          message: 'Anda sudah pernah mengirim ulasan.',
        });
      }

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userId },
        select: { id: true },
      });

      if (!peserta) {
        return res.status(403).json({
          status: false,
          message: 'Hanya peserta magang yang dapat mengirim ulasan.',
        });
      }

      const ajuan = await prisma.ajuanMagang.findFirst({
        where: {
          pesertaId: peserta.id,
          statusUsulan: 'APPROVED',
        },
        orderBy: {
          tglSelesai: 'desc',
        },
        select: {
          id: true,
          tglMulai: true,
          tglSelesai: true,
          laporan: {
            select: { id: true },
          },
        },
      });

      if (!ajuan) {
        return res.status(404).json({
          status: false,
          message: 'Data magang Anda yang disetujui tidak ditemukan.',
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tglSelesai = new Date(ajuan.tglSelesai);

      if (today <= tglSelesai) {
        return res.status(403).json({
          status: false,
          message: `Anda baru bisa memberi ulasan setelah periode magang Anda berakhir (setelah ${tglSelesai.toLocaleDateString(
            'id-ID'
          )}).`,
        });
      }

      if (!ajuan.laporan) {
        return res.status(403).json({
          status: false,
          message:
            'Anda harus mengirim Laporan Hasil Magang terlebih dahulu sebelum dapat memberi ulasan.',
        });
      }

      const expectedLogbooks = calculateWorkdays(
        ajuan.tglMulai,
        ajuan.tglSelesai
      );
      const logbookCount = await prisma.logbook.count({
        where: { ajuanId: ajuan.id },
      });

      if (logbookCount < expectedLogbooks) {
        return res.status(403).json({
          status: false,
          message: `Anda harus melengkapi semua logbook harian (${logbookCount} dari ${expectedLogbooks} hari kerja) sebelum memberi ulasan.`,
        });
      }

      const ulasanBaru = await prisma.ulasanMagang.create({
        data: {
          ulasan: ulasan,
          rating: parseInt(rating, 10),
          userId: userId,
        },
      });

      res.status(201).json({
        status: true,
        message: 'Ulasan magang berhasil dikirim!',
        data: ulasanBaru,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllUlasanForAdmin: async (req, res, next) => {
    try {
      const { searchNama, filterBidang, filterRating, filterTanggal } =
        req.query;

      const where = {};

      if (searchNama) {
        where.user = {
          pesertaMagang: {
            namaLengkap: {
              contains: searchNama,
              mode: 'insensitive',
            },
          },
        };
      }

      if (filterBidang) {
        where.user = {
          ...where.user,
          pesertaMagang: {
            ...where.user?.pesertaMagang,
            bidang: {
              nama: {
                equals: filterBidang,
              },
            },
          },
        };
      }

      if (filterRating) {
        where.rating = {
          equals: parseInt(filterRating, 10),
        };
      }

      if (filterTanggal) {
        const startDate = new Date(filterTanggal);
        const endDate = new Date(filterTanggal);
        endDate.setDate(endDate.getDate() + 1);

        where.createdAt = {
          gte: startDate,
          lt: endDate,
        };
      }

      const ulasanList = await prisma.ulasanMagang.findMany({
        where: where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              pesertaMagang: {
                select: {
                  namaLengkap: true,
                  pasFoto: true,
                  bidang: {
                    select: { nama: true },
                  },
                },
              },
            },
          },
        },
      });

      const formattedData = ulasanList.map((item) => ({
        id: item.id,
        nama: item.user?.pesertaMagang?.namaLengkap || 'User Dihapus',
        bidang: item.user?.pesertaMagang?.bidang?.nama || 'N/A',
        foto:
          item.user?.pesertaMagang?.pasFoto ||
          'https://via.placeholder.com/150',
        tanggal: item.createdAt,
        ulasan: item.ulasan,
        rating: item.rating,
      }));

      res.status(200).json({
        status: true,
        message: 'Data ulasan berhasil diambil.',
        data: formattedData,
      });
    } catch (error) {
      next(error);
    }
  },

  getPublicUlasan: async (req, res, next) => {
    try {
      const ulasanList = await prisma.ulasanMagang.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              pesertaMagang: {
                select: {
                  namaLengkap: true,
                  pasFoto: true,
                  bidang: {
                    select: { nama: true },
                  },
                },
              },
            },
          },
        },
      });

      const formattedTestimoni = ulasanList.map((item) => ({
        name: item.user?.pesertaMagang?.namaLengkap || 'Alumni Magang',
        bidang: item.user?.pesertaMagang?.bidang?.nama || 'N/A',
        tanggal: new Date(item.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        foto: item.user?.pesertaMagang?.pasFoto || '/images/default-avatar.jpg',
        ulasan: item.ulasan,
        rating: item.rating,
      }));

      res.status(200).json({
        status: true,
        message: 'Data testimoni publik berhasil diambil.',
        data: formattedTestimoni,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllUlasanForPublicPage: async (req, res, next) => {
    try {
      const ulasanList = await prisma.ulasanMagang.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              pesertaMagang: {
                select: {
                  namaLengkap: true,
                  pasFoto: true,
                  bidang: {
                    select: { nama: true },
                  },
                },
              },
            },
          },
        },
      });

      const formattedTestimoni = ulasanList.map((item) => ({
        name: item.user?.pesertaMagang?.namaLengkap || 'Alumni Magang',
        bidang: item.user?.pesertaMagang?.bidang?.nama || 'N/A',
        tanggal: item.createdAt.toISOString(),
        foto: item.user?.pesertaMagang?.pasFoto || '/images/default-avatar.jpg',
        ulasan: item.ulasan,
        rating: item.rating,
      }));

      res.status(200).json({
        status: true,
        message: 'Semua testimoni publik berhasil diambil.',
        data: formattedTestimoni,
      });
    } catch (error) {
      next(error);
    }
  },
};
