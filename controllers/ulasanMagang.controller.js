const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
