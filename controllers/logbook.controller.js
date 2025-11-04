const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getApprovedInternData = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      pesertaMagang: {
        include: {
          ajuan: {
            where: {
              statusUsulan: 'DITERIMA',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!user || !user.pesertaMagang) {
    throw new Error('Hanya peserta magang yang dapat mengakses fitur ini');
  }

  const ajuanDisetujui = user.pesertaMagang.ajuan[0];
  if (!ajuanDisetujui) {
    throw new Error('Anda tidak memiliki ajuan magang yang telah disetujui');
  }

  return {
    pesertaId: user.pesertaMagang.id,
    ajuan: ajuanDisetujui,
  };
};

module.exports = {
  getLogbookData: async (req, res) => {
    try {
      const { ajuan, pesertaId } = await getApprovedInternData(req.user.id);

      const logbooks = await prisma.logbook.findMany({
        where: {
          pesertaId: pesertaId,
          tanggal: {
            gte: ajuan.tglMulai,
            lte: ajuan.tglSelesai,
          },
        },
        orderBy: {
          tanggal: 'asc',
        },
      });

      res.status(200).json({
        message: 'Data logbook berhasil diambil',
        data: {
          periode: {
            tglMulai: ajuan.tglMulai,
            tglSelesai: ajuan.tglSelesai,
          },
          logbooks: logbooks,
        },
      });
    } catch (error) {
      if (
        error.message.includes('Hanya peserta magang') ||
        error.message.includes('tidak memiliki ajuan')
      ) {
        return res.status(403).json({ message: error.message });
      }
      console.error('Error [getLogbookData]:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  createOrUpdateLogbook: async (req, res) => {
    const { tanggal, deskripsi } = req.body;

    if (!tanggal || deskripsi === undefined) {
      return res
        .status(400)
        .json({ message: 'Tanggal dan deskripsi wajib diisi' });
    }

    try {
      const { ajuan, pesertaId } = await getApprovedInternData(req.user.id);

      const tanggalLogbook = new Date(tanggal + 'T00:00:00Z');
      const tglMulai = new Date(
        ajuan.tglMulai.toISOString().split('T')[0] + 'T00:00:00Z'
      );
      const tglSelesai = new Date(
        ajuan.tglSelesai.toISOString().split('T')[0] + 'T00:00:00Z'
      );
      const today = new Date();
      const todayDateOnly = new Date(
        today.toISOString().split('T')[0] + 'T00:00:00Z'
      );

      if (isNaN(tanggalLogbook.getTime())) {
        return res.status(400).json({ message: 'Format tanggal tidak valid' });
      }

      if (tanggalLogbook > todayDateOnly) {
        return res.status(400).json({
          message: 'Tidak dapat mengirim logbook untuk tanggal di masa depan',
        });
      }

      if (tanggalLogbook < tglMulai || tanggalLogbook > tglSelesai) {
        return res.status(400).json({
          message: `Tanggal logbook (${tanggal}) harus berada dalam periode magang Anda.`,
        });
      }

      const logbook = await prisma.logbook.upsert({
        where: {
          pesertaId_tanggal: {
            pesertaId: pesertaId,
            tanggal: tanggalLogbook,
          },
        },
        update: {
          deskripsi: deskripsi,
        },
        create: {
          pesertaId: pesertaId,
          tanggal: tanggalLogbook,
          deskripsi: deskripsi,
        },
      });

      res
        .status(200)
        .json({ message: 'Logbook berhasil disimpan', data: logbook });
    } catch (error) {
      if (
        error.message.includes('Hanya peserta magang') ||
        error.message.includes('tidak memiliki ajuan')
      ) {
        return res.status(403).json({ message: error.message });
      }

      if (error.code === 'P2002') {
        return res
          .status(409)
          .json({ message: 'Logbook untuk tanggal ini sudah ada.' });
      }
      console.error('Error [createOrUpdateLogbook]:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getAllLogbooks: async (req, res) => {
    try {
      const { search, bidangId, tanggal, page = 1, limit = 10 } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const where = {};

      if (req.user.role === 'sub_koordinator_bidang') {
        const subkoor = await prisma.subKoordinatorBidang.findUnique({
          where: { userId: req.user.id },
        });
        if (!subkoor) {
          return res
            .status(404)
            .json({ message: 'Data sub-koordinator tidak ditemukan' });
        }
        where.peserta = { bidangId: subkoor.bidangId };
      } else if (req.user.role === 'admin' && bidangId) {
        where.peserta = { bidangId: bidangId };
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
      }

      if (tanggal) {
        try {
          const filterDate = new Date(tanggal);
          filterDate.setHours(0, 0, 0, 0);
          where.tanggal = filterDate;
        } catch (e) {
          return res
            .status(400)
            .json({ message: 'Format tanggal filter tidak valid' });
        }
      }

      if (search) {
        where.OR = [
          { peserta: { namaLengkap: { contains: search } } },
          { peserta: { instansi: { contains: search } } },
        ];
      }

      const [logbooks, total] = await Promise.all([
        prisma.logbook.findMany({
          where: where,
          include: {
            peserta: {
              select: {
                namaLengkap: true,
                instansi: true,
                pasFoto: true,
                bidang: {
                  select: {
                    nama: true,
                  },
                },
              },
            },
          },
          orderBy: [{ tanggal: 'desc' }, { updatedAt: 'desc' }],
          skip: skip,
          take: limitNum,
        }),
        prisma.logbook.count({ where: where }),
      ]);

      const formattedData = logbooks.map((log) => ({
        id: log.id,
        peserta: log.peserta.namaLengkap,
        bidang: log.peserta.bidang
          ? log.peserta.bidang.nama
          : 'Belum Ditentukan',
        instansi: log.peserta.instansi,
        pasFoto: log.peserta.pasFoto,
        tanggal: log.tanggal,
        kegiatan: log.deskripsi,
        tanggalSubmit: log.updatedAt,
      }));

      res.status(200).json({
        message: 'Logbook berhasil diambil',
        data: formattedData,
        pagination: {
          totalItems: total,
          totalPages: Math.ceil(total / limitNum),
          currentPage: pageNum,
          itemsPerPage: limitNum,
        },
      });
    } catch (error) {
      console.error('Error [getAllLogbooks]:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getLogbookById: async (req, res) => {
    try {
      const { id } = req.params;

      const logbook = await prisma.logbook.findUnique({
        where: { id: id },
        include: {
          peserta: {
            select: {
              namaLengkap: true,
              instansi: true,
              pasFoto: true,
              bidang: {
                select: {
                  nama: true,
                },
              },
            },
          },
        },
      });

      if (!logbook) {
        return res.status(404).json({ message: 'Logbook tidak ditemukan' });
      }

      if (req.user.role === 'sub_koordinator_bidang') {
        const subkoor = await prisma.subKoordinatorBidang.findUnique({
          where: { userId: req.user.id },
        });
        if (logbook.peserta.bidangId !== subkoor.bidangId) {
          return res
            .status(403)
            .json({ message: 'Anda tidak memiliki akses ke logbook ini' });
        }
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
      }

      const formattedData = {
        id: logbook.id,
        peserta: logbook.peserta.namaLengkap,
        instansi: logbook.peserta.instansi,
        bidang: logbook.peserta.bidang
          ? logbook.peserta.bidang.nama
          : 'Belum Ditentukan',
        pasFoto: logbook.peserta.pasFoto,
        tanggal: logbook.tanggal,
        kegiatan: logbook.deskripsi,
        tanggalSubmit: logbook.updatedAt,
      };

      res.status(200).json({ data: formattedData });
    } catch (error) {
      console.error('Error [getLogbookById]:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
};
