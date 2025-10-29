const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  createUlasan: async (req, res, next) => {
    try {
      const { ulasan, rating } = req.body;

      // 1. Cek autentikasi (pastikan middleware auth sudah berjalan sebelumnya)
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message: 'Anda harus login untuk mengirim ulasan.',
          data: null,
        });
      }

      const userId = req.user.id;

      // 2. Validasi input
      if (!ulasan || !rating) {
        return res.status(400).json({
          status: false,
          message: 'Ulasan dan rating wajib diisi.',
          data: null,
        });
      }

      // 3. Simpan ke database
      const ulasanBaru = await prisma.ulasanMagang.create({
        data: {
          ulasan: ulasan,
          rating: parseInt(rating, 10),
          userId: userId, // Langsung hubungkan dengan userId dari sesi
        },
      });

      // 4. Kirim respon sukses
      res.status(201).json({
        status: true,
        message: 'Ulasan magang berhasil dikirim!',
        data: ulasanBaru,
      });
    } catch (error) {
      // 5. Tangani error
      next(error);
    }
  },

  /**
   * (ADMIN) Mengambil semua data ulasan untuk dashboard admin.
   * Mendukung filtering berdasarkan nama, bidang, rating, dan tanggal.
   */
  getAllUlasanForAdmin: async (req, res, next) => {
    try {
      // Ambil query params dari frontend admin (ManageUlasanMagang.jsx)
      const { searchNama, filterBidang, filterRating, filterTanggal } =
        req.query;

      const where = {};

      // 1. Filter Pencarian Nama
      if (searchNama) {
        where.user = {
          pesertaMagang: {
            namaLengkap: {
              contains: searchNama,
              mode: 'insensitive', // Tidak case-sensitive
            },
          },
        };
      }

      // 2. Filter Bidang
      if (filterBidang) {
        where.user = {
          ...where.user, // Gabungkan dengan filter nama jika ada
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

      // 3. Filter Rating
      if (filterRating) {
        where.rating = {
          equals: parseInt(filterRating, 10),
        };
      }

      // 4. Filter Tanggal
      if (filterTanggal) {
        const startDate = new Date(filterTanggal); // YYYY-MM-DD
        const endDate = new Date(filterTanggal);
        endDate.setDate(endDate.getDate() + 1); // Set ke hari berikutnya jam 00:00

        where.createdAt = {
          gte: startDate,
          lt: endDate,
        };
      }

      // 5. Ambil data dari database
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

      // 6. Format data agar sesuai dengan kebutuhan frontend (ManageUlasanMagang.jsx)
      const formattedData = ulasanList.map((item) => ({
        id: item.id,
        nama: item.user?.pesertaMagang?.namaLengkap || 'User Dihapus',
        bidang: item.user?.pesertaMagang?.bidang?.nama || 'N/A',
        foto:
          item.user?.pesertaMagang?.pasFoto ||
          'https://via.placeholder.com/150', // Gambar default
        tanggal: item.createdAt,
        ulasan: item.ulasan,
        rating: item.rating,
      }));

      // 7. Kirim respon sukses
      res.status(200).json({
        status: true,
        message: 'Data ulasan berhasil diambil.',
        data: formattedData,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * (PUBLIK) Mengambil ulasan terbaru untuk ditampilkan di beranda.
   * Tidak memerlukan login.
   */
  getPublicUlasan: async (req, res, next) => {
    try {
      // Ambil 5 ulasan terbaru
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

      // Format data agar sesuai dengan kebutuhan TestimoniCard
      const formattedTestimoni = ulasanList.map((item) => ({
        name: item.user?.pesertaMagang?.namaLengkap || 'Alumni Magang',
        bidang: item.user?.pesertaMagang?.bidang?.nama || 'N/A',
        tanggal: new Date(item.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        foto: item.user?.pesertaMagang?.pasFoto || '/images/default-avatar.jpg', // Sediakan foto default
        ulasan: item.ulasan,
        rating: item.rating,
      }));

      // Kirim respon sukses
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
        // Ambil semua, urutkan terbaru saja sebagai default
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

      // Format data agar sesuai dengan TestimoniCard
      const formattedTestimoni = ulasanList.map((item) => ({
        name: item.user?.pesertaMagang?.namaLengkap || 'Alumni Magang',
        bidang: item.user?.pesertaMagang?.bidang?.nama || 'N/A',
        // Kirim sebagai ISO string agar new Date() di frontend valid
        tanggal: item.createdAt.toISOString(),
        foto: item.user?.pesertaMagang?.pasFoto || '/images/default-avatar.jpg', // Sediakan foto default
        ulasan: item.ulasan,
        rating: item.rating,
      }));

      res.status(200).json({
        status: true,
        message: 'Semua testimoni publik berhasil diambil.',
        data: formattedTestimoni, // Kirim array-nya langsung
      });
    } catch (error) {
      next(error);
    }
  },
};
