const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateTotalDays(startDate, endDate) {
  const start = new Date(startDate.getTime());
  const end = new Date(endDate.getTime());
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

module.exports = {
  createUlasan: async (req, res, next) => {
    try {
      const { ulasan, rating, ajuanId } = req.body;

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message: 'Anda harus login untuk mengirim ulasan.',
          data: null,
        });
      }

      const userId = req.user.id;

      if (!ulasan || !rating || !ajuanId) {
        return res.status(400).json({
          status: false,
          message: 'Ajuan ID, ulasan, dan rating wajib diisi.',
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

      const existingUlasan = await prisma.ulasanMagang.findFirst({
        where: { userId: userId },
      });

      if (existingUlasan) {
        return res.status(409).json({
          status: false,
          message: 'Anda sudah pernah mengirim ulasan.',
        });
      }

      const ajuan = await prisma.ajuanMagang.findFirst({
        where: {
          id: ajuanId,
          pesertaId: peserta.id,
        },
        select: {
          id: true,
          tglMulai: true,
          tglSelesai: true,
          ulasan: true,
          laporan: {
            select: { id: true, status: true },
          },
        },
      });

      if (!ajuan) {
        return res.status(404).json({
          status: false,
          message: 'Data ajuan magang tidak ditemukan atau bukan milik Anda.',
        });
      }

      if (ajuan.ulasan) {
        return res.status(409).json({
          status: false,
          message: 'Anda sudah pernah mengirim ulasan untuk magang ini.',
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tglSelesai = new Date(ajuan.tglSelesai);

      if (today <= tglSelesai) {
        return res.status(403).json({
          status: false,
          message: `Anda baru bisa memberi ulasan setelah periode magang berakhir (setelah ${tglSelesai.toLocaleDateString(
            'id-ID'
          )}).`,
        });
      }

      if (!ajuan.laporan) {
        return res.status(403).json({
          status: false,
          message: 'Anda harus mengirim Laporan Hasil Magang terlebih dahulu.',
        });
      }
      if (ajuan.laporan.status !== 'APPROVED') {
        return res.status(403).json({
          status: false,
          message: `Laporan Anda harus berstatus "APPROVED" (Status saat ini: ${ajuan.laporan.status}).`,
        });
      }
      const expectedLogbooks = calculateTotalDays(
        ajuan.tglMulai,
        ajuan.tglSelesai
      );
      const logbookCount = await prisma.logbook.count({
        where: { ajuanId: ajuan.id },
      });

      if (logbookCount < expectedLogbooks) {
        return res.status(403).json({
          status: false,
          message: `Anda harus melengkapi semua logbook harian (${logbookCount} dari ${expectedLogbooks} hari) sebelum memberi ulasan.`,
        });
      }

      const ulasanBaru = await prisma.ulasanMagang.create({
        data: {
          ulasan: ulasan,
          rating: parseInt(rating, 10),
          ajuanId: ajuanId,
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

      if (filterRating) {
        where.rating = { equals: parseInt(filterRating, 10) };
      }
      if (filterTanggal) {
        const startDate = new Date(filterTanggal);
        const endDate = new Date(filterTanggal);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt = { gte: startDate, lt: endDate };
      }

      // PERUBAHAN: Filter relasional
      where.ajuan = {};
      if (searchNama) {
        where.ajuan.peserta = {
          namaLengkap: { contains: searchNama, mode: 'insensitive' },
        };
      }
      if (filterBidang) {
        where.ajuan.bidang = {
          nama: { equals: filterBidang },
        };
      }

      const ulasanList = await prisma.ulasanMagang.findMany({
        where: where,
        orderBy: { createdAt: 'desc' },
        include: {
          ajuan: {
            select: {
              bidang: { select: { nama: true } },
              peserta: {
                select: {
                  namaLengkap: true,
                  pasFoto: true,
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
          ajuan: {
            select: {
              bidang: { select: { nama: true } },
              peserta: {
                select: {
                  namaLengkap: true,
                  pasFoto: true,
                },
              },
            },
          },
        },
      });

      const formattedTestimoni = ulasanList.map((item) => ({
        name: item.ajuan?.peserta?.namaLengkap || 'Alumni Magang',
        bidang: item.ajuan?.bidang?.nama || 'N/A',
        tanggal: new Date(item.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        foto: item.ajuan?.peserta?.pasFoto || '/images/default-avatar.jpg',
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
        // PERUBAHAN: 'include' data melalui 'ajuan'
        include: {
          ajuan: {
            select: {
              bidang: { select: { nama: true } },
              peserta: {
                select: {
                  namaLengkap: true,
                  pasFoto: true,
                },
              },
            },
          },
        },
      });

      const formattedTestimoni = ulasanList.map((item) => ({
        name: item.ajuan?.peserta?.namaLengkap || 'Alumni Magang',
        bidang: item.ajuan?.bidang?.nama || 'N/A',
        tanggal: item.createdAt.toISOString(),
        foto: item.ajuan?.peserta?.pasFoto || '/images/default-avatar.jpg',
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

  getUlasanEligibility: async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ status: false, message: 'Wajib login.' });
      }
      const userId = req.user.id;

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userId },
        select: { id: true },
      });

      if (!peserta) {
        return res
          .status(403)
          .json({ status: false, message: 'Hanya peserta.' });
      }

      // Ambil SEMUA ajuan magang peserta
      const allAjuan = await prisma.ajuanMagang.findMany({
        where: {
          pesertaId: peserta.id,
          statusUsulan: 'APPROVED', // Hanya cek yang disetujui
        },
        orderBy: { tglSelesai: 'desc' },
        select: {
          id: true,
          temaMagang: true,
          tglMulai: true,
          tglSelesai: true,
          ulasan: { select: { id: true } }, // Cek apakah ulasan sudah ada
          laporan: { select: { status: true } }, // Cek status laporan
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Kita akan memproses setiap ajuan dan memberinya status
      const eligibilityStatus = [];

      for (const ajuan of allAjuan) {
        let status = 'INELIGIBLE';
        let message = '';
        let eligible = false;

        if (ajuan.ulasan) {
          status = 'COMPLETED';
          message = 'Ulasan sudah diberikan.';
        } else if (today <= new Date(ajuan.tglSelesai)) {
          message = `Periode magang masih berjalan (selesai ${new Date(
            ajuan.tglSelesai
          ).toLocaleDateString('id-ID')}).`;
        } else if (!ajuan.laporan) {
          message = 'Laporan akhir belum di-submit.';
        } else if (ajuan.laporan.status !== 'APPROVED') {
          message = `Laporan akhir belum disetujui (Status: ${ajuan.laporan.status}).`;
        } else {
          // Cek Logbook
          const expectedLogbooks = calculateTotalDays(
            ajuan.tglMulai,
            ajuan.tglSelesai
          );
          const logbookCount = await prisma.logbook.count({
            where: { ajuanId: ajuan.id },
          });

          if (logbookCount < expectedLogbooks) {
            message = `Logbook harian belum lengkap (${logbookCount}/${expectedLogbooks}).`;
          } else {
            // Semua syarat terpenuhi!
            status = 'ELIGIBLE';
            message = 'Anda dapat memberikan ulasan untuk magang ini.';
            eligible = true;
          }
        }

        eligibilityStatus.push({
          ajuanId: ajuan.id,
          temaMagang: ajuan.temaMagang,
          status: status,
          message: message,
          eligible: eligible,
        });
      }

      res.status(200).json({
        status: true,
        message: 'Data kelayakan ulasan diambil.',
        data: eligibilityStatus,
      });
    } catch (error) {
      next(error);
    }
  },
};
