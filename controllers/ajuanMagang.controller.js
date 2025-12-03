const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// const { prisma } = require('../utils/database');
const sendEmail = require('../utils/sendEmail');
// const { formatDate } = require('../utils/formatedDate');
const ejs = require('ejs');
const path = require('path');

const cekKuota = async (bidangId) => {
  if (!bidangId) {
    throw new Error('ID Bidang (bidangPilihan) tidak boleh kosong.');
  }

  let bidang;
  try {
    bidang = await prisma.kuotaBidang.findUnique({
      where: { id: bidangId },
      select: { kuota: true },
    });
  } catch (prismaError) {
    console.error('Error Prisma saat mencari bidang:', prismaError.message);
    throw new Error(
      `Format ID Bidang tidak valid. Pastikan Anda mengirim UUID.`
    );
  }

  if (!bidang) {
    throw new Error(
      `Bidang tidak ditemukan. ID (${bidangId}) tidak ada di database.`
    );
  }

  try {
    const jumlahDiterima = await prisma.ajuanMagang.count({
      where: {
        bidangId: bidangId,
        statusUsulan: 'APPROVED',
      },
    });
    return jumlahDiterima < bidang.kuota;
  } catch (countError) {
    console.error('Error saat menghitung jumlah ajuan:', countError);
    throw new Error(`Gagal menghitung kuota: ${countError.message}`);
  }
};

const getEligiblePeserta = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const peserta = await prisma.pesertaMagang.findUnique({
    where: { userId },
    select: {
      id: true,
      ajuan: {
        where: {
          OR: [
            { statusUsulan: 'PENDING' },
            { statusUsulan: 'APPROVED', tglSelesai: { gte: today } },
          ],
        },
        take: 1,
      },
    },
  });

  if (!peserta) throw new Error('Profil peserta magang tidak ditemukan.');

  if (peserta.ajuan.length > 0) {
    const existing = peserta.ajuan[0];
    const msg =
      existing.statusUsulan === 'APPROVED'
        ? 'Anda sudah diterima magang dan periode magang Anda belum selesai.'
        : 'Anda sudah memiliki ajuan magang yang sedang diproses (PENDING).';

    const error = new Error(
      `${msg} Anda dapat mengajukan lagi setelah selesai atau ditolak.`
    );
    error.isEligibilityError = true; // Penanda untuk error handling
    throw error;
  }

  return peserta;
};

module.exports = {
  createAjuanMagang: async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message:
            'Autentikasi gagal. Token tidak valid atau user tidak ditemukan.',
          data: null,
        });
      }
      const userIdFromToken = req.user.id;

      const {
        namaLengkap,
        nis_nim,
        kategori,
        statusPendidikan,
        jenjangPendidikan,
        instansi,
        jurusan,
        durasiMulai,
        durasiSelesai,
        tema,
        bidangPilihan,
      } = req.body;

      const berkas_urls = req.body.berkas_urls;
      if (
        !berkas_urls ||
        !berkas_urls.surat_pengantar ||
        !berkas_urls.proposal_magang ||
        !berkas_urls.cv ||
        !berkas_urls.ktp ||
        !berkas_urls.surat_bakesbang_sda
      ) {
        return res.status(400).json({
          status: false,
          message:
            'Upload berkas wajib gagal atau tidak lengkap. Pastikan semua file (kecuali Bakesbangpol Prov) terisi.',
          data: null,
        });
      }

      // --- MULAI VALIDASI TANGGAL ---
      const startDate = new Date(durasiMulai);
      const endDate = new Date(durasiSelesai);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      if (startDate < todayDate) {
        return res.status(400).json({
          status: false,
          message: 'Tanggal mulai magang tidak boleh kurang dari hari ini.',
          data: null,
        });
      }

      const minEndDate = new Date(startDate);
      minEndDate.setMonth(minEndDate.getMonth() + 1);

      if (endDate < minEndDate) {
        return res.status(400).json({
          status: false,
          message: 'Durasi magang minimal harus 1 bulan.',
          data: null,
        });
      }

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userIdFromToken },
        select: {
          id: true,
          ajuan: {
            where: {
              OR: [
                { statusUsulan: 'PENDING' },
                {
                  statusUsulan: 'APPROVED',
                  tglSelesai: { gte: todayDate },
                },
              ],
            },
            take: 1,
          },
        },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Profil peserta magang tidak ditemukan.',
          data: null,
        });
      }

      if (peserta.ajuan && peserta.ajuan.length > 0) {
        const existingAjuan = peserta.ajuan[0];
        let message =
          'Anda sudah memiliki ajuan magang yang sedang diproses (PENDING).';
        if (existingAjuan.statusUsulan === 'APPROVED') {
          message =
            'Anda sudah diterima magang dan periode magang Anda belum selesai.';
        }
        return res.status(400).json({
          status: false,
          message: `${message} Anda dapat mengajukan lagi setelah ajuan ditolak atau periode magang selesai.`,
          data: null,
        });
      }

      const dataBerkas = {
        suratPengantar: berkas_urls.surat_pengantar,
        proposalMagang: berkas_urls.proposal_magang,
        cv: berkas_urls.cv,
        ktp: berkas_urls.ktp,
        suratBakesbangpolSda: berkas_urls.surat_bakesbang_sda,
        ...(berkas_urls.surat_bakesbang_prov && {
          suratBakesbangpolProv: berkas_urls.surat_bakesbang_prov,
        }),
      };

      const ajuanBaru = await prisma.$transaction(async (tx) => {
        await tx.pesertaMagang.update({
          where: { id: peserta.id },
          data: {
            namaLengkap: namaLengkap,
            nimNis: nis_nim,
            instansi: instansi,
            jurusan: jurusan,
          },
        });

        const kuotaTersedia = await cekKuota(bidangPilihan);
        if (!kuotaTersedia) {
          throw new Error('Kuota untuk bidang ini sudah penuh.');
        }

        const ajuan = await tx.ajuanMagang.create({
          data: {
            kategoriMagang: kategori,
            statusPendidikan: statusPendidikan,
            jenjangPendidikan: jenjangPendidikan,
            instansi: instansi,
            jurusan: jurusan,
            tglMulai: new Date(durasiMulai),
            tglSelesai: new Date(durasiSelesai),
            temaMagang: tema,
            statusUsulan: 'PENDING',
            peserta: { connect: { id: peserta.id } },
            bidang: { connect: { id: bidangPilihan } },
          },
        });

        await tx.berkasMagang.create({
          data: {
            ...dataBerkas,
            ajuan: { connect: { id: ajuan.id } },
          },
        });

        return ajuan;
      });

      res.status(201).json({
        status: true,
        message: 'Ajuan magang dan semua berkas berhasil dikirim.',
        data: ajuanBaru,
      });
    } catch (error) {
      if (error.message === 'Kuota untuk bidang ini sudah penuh.') {
        return res.status(400).json({
          status: false,
          message: error.message,
          data: null,
        });
      }

      if (error.code === 'P2025') {
        return res.status(404).json({
          status: false,
          message: 'Gagal memproses: Record terkait tidak ditemukan (P2025).',
          data: null,
        });
      }

      next(error);
    }
  },

  getAjuanMagangByPeserta: async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message: 'Data pengguna tidak ditemukan dari token.',
          data: null,
        });
      }

      const userIdFromToken = req.user.id;

      const peserta = await prisma.pesertaMagang.findUnique({
        where: { userId: userIdFromToken },
        select: { id: true },
      });

      if (!peserta) {
        return res.status(404).json({
          status: false,
          message: 'Profil peserta magang tidak ditemukan.',
          data: null,
        });
      }

      const riwayatAjuan = await prisma.ajuanMagang.findMany({
        where: { pesertaId: peserta.id },
        select: {
          id: true,
          createdAt: true,
          temaMagang: true,
          tglMulai: true,
          tglSelesai: true,
          statusUsulan: true,
          bidang: {
            select: {
              id: true,
              nama: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        status: true,
        message: 'Riwayat ajuan berhasil diambil.',
        data: riwayatAjuan,
      });
    } catch (error) {
      next(error);
    }
  },

  getDetailAjuanMagang: async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message: 'Autentikasi gagal. Token tidak valid.',
          data: null,
        });
      }
      const userIdFromToken = req.user.id;

      const { id: ajuanId } = req.params;
      if (!ajuanId) {
        return res
          .status(400)
          .json({ status: false, message: 'ID Ajuan diperlukan.', data: null });
      }

      const ajuan = await prisma.ajuanMagang.findUnique({
        where: {
          id: ajuanId,
        },
        include: {
          bidang: {
            select: {
              nama: true,
            },
          },
          peserta: true,
          berkas: true,
        },
      });

      if (!ajuan) {
        return res
          .status(404)
          .json({ status: false, message: 'Ajuan magang tidak ditemukan.' });
      }

      if (ajuan.peserta.userId !== userIdFromToken) {
        return res.status(403).json({
          status: false,
          message: 'Anda tidak memiliki izin untuk melihat detail ajuan ini.',
          data: null,
        });
      }

      res.status(200).json({
        status: true,
        message: 'Detail ajuan magang berhasil diambil.',
        data: ajuan,
      });
    } catch (error) {
      next(error);
    }
  },

  getAllAjuanMagang: async (req, res, next) => {
    try {
      const { role, userId } = req.user;
      const { status, search, page = 1, limit = 10 } = req.query;

      let whereClause = {};

      if (role === 'sub_koordinator_bidang') {
        const subKoor = await prisma.subKoordinatorBidang.findUnique({
          where: { userId: userId },
          select: { bidangId: true },
        });

        if (subKoor) {
          whereClause.bidangId = subKoor.bidangId;
        } else {
          return res.status(403).json({
            status: false,
            message: 'Anda tidak terdaftar di bidang manapun.',
            data: null,
          });
        }
      }

      if (status && status !== 'all') {
        const statusMap = {
          PENDING: 'PENDING',
          DITERIMA: 'APPROVED',
          DITOLAK: 'REJECTED',
        };

        const prismaStatus = statusMap[status.toUpperCase()];

        if (prismaStatus) {
          whereClause.statusUsulan = prismaStatus;
        }
      }

      if (search) {
        whereClause.OR = [
          { temaMagang: { contains: search } },
          { instansi: { contains: search } },
          { jurusan: { contains: search } },
          {
            peserta: {
              namaLengkap: { contains: search },
            },
          },
          {
            bidang: {
              nama: { contains: search },
            },
          },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const [ajuanList, totalItems] = await prisma.$transaction([
        prisma.ajuanMagang.findMany({
          where: whereClause,
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            instansi: true,
            jurusan: true,
            statusPendidikan: true,
            jenjangPendidikan: true,
            temaMagang: true,
            tglMulai: true,
            tglSelesai: true,
            statusUsulan: true,

            peserta: {
              select: {
                id: true,
                namaLengkap: true,
                nimNis: true,
                user: { select: { email: true } },
                pasFoto: true,
              },
            },
            bidang: {
              select: { nama: true },
            },
            berkas: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: skip,
          take: take,
        }),
        prisma.ajuanMagang.count({ where: whereClause }),
      ]);

      res.status(200).json({
        status: true,
        message: 'Data ajuan magang berhasil diambil.',
        data: ajuanList,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalItems / take),
          totalItems: totalItems,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  updateStatusAjuan: async (req, res, next) => {
    try {
      const { id: ajuanId } = req.params;
      const { status } = req.body;

      if (!['DITERIMA', 'DITOLAK'].includes(status)) {
        return res.status(400).json({
          status: false,
          message: "Status harus 'DITERIMA' atau 'DITOLAK'.",
          data: null,
        });
      }

      const statusUsulanEnum = status === 'DITERIMA' ? 'APPROVED' : 'REJECTED';
      const statusPesertaEnum = status === 'DITERIMA' ? 'APPROVED' : 'REJECTED';

      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        select: {
          id: true,
          statusUsulan: true,
          tglMulai: true,
          tglSelesai: true,
          peserta: {
            select: {
              id: true,
              namaLengkap: true,
              user: { select: { email: true } },
            },
          },
          bidang: {
            select: { id: true, nama: true },
          },
        },
      });

      if (!ajuan) {
        return res.status(404).json({
          status: false,
          message: 'Ajuan Magang tidak ditemukan.',
          data: null,
        });
      }

      if (status === 'DITERIMA' && ajuan.statusUsulan !== 'APPROVED') {
        const kuotaTersedia = await cekKuota(ajuan.bidang.id);
        if (!kuotaTersedia) {
          return res.status(400).json({
            status: false,
            message: 'Gagal menerima. Kuota untuk bidang ini sudah penuh.',
            data: null,
          });
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.ajuanMagang.update({
          where: { id: ajuanId },
          data: { statusUsulan: statusUsulanEnum },
        });

        await tx.pesertaMagang.update({
          where: { id: ajuan.peserta.id },
          data: {
            status: statusPesertaEnum,
            ...(status === 'DITERIMA' && { bidangId: ajuan.bidang.id }),
          },
        });
      });

      const { email: emailPeserta } = ajuan.peserta.user;
      const { namaLengkap: namaPeserta } = ajuan.peserta;

      if (!emailPeserta) {
        console.error(
          `Gagal mengirim email: Email tidak ditemukan untuk peserta ${namaPeserta} (ID: ${ajuan.peserta.id})`
        );

        return res.status(200).json({
          status: true,
          message: `Ajuan berhasil di-${status.toLowerCase()}. PERINGATAN: Notifikasi email GAGAL terkirim (email peserta tidak terdaftar).`,
          data: null,
        });
      }

      let emailSubject = '';
      let templateData = {};

      const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      };

      if (status === 'DITERIMA') {
        emailSubject = 'Selamat! Usulan Magang Anda Diterima 🎉';
        templateData = {
          namaLengkap: namaPeserta,
          diterima: true,
          detail: {
            namaBidang: ajuan.bidang.nama,
            tanggalMulai: formatDate(ajuan.tglMulai),
            tanggalSelesai: formatDate(ajuan.tglSelesai),
          },
        };
      } else {
        emailSubject = 'Pemberitahuan Status Usulan Magang';
        templateData = {
          namaLengkap: namaPeserta,
          diterima: false,
          detail: {},
        };
      }

      const templatePath = path.join(
        __dirname,
        '../views/sendNoticeInternProposal.ejs'
      );

      ejs.renderFile(templatePath, templateData, (err, html) => {
        if (err) {
          console.error('Gagal me-render EJS untuk email:', err);
        } else {
          sendEmail({
            from: process.env.SENDER_GMAIL,
            to: emailPeserta,
            subject: emailSubject,
            html: html,
          }).catch((emailError) => {
            console.error(
              'Gagal mengirim email notifikasi status:',
              emailError
            );
          });
        }
      });

      res.status(200).json({
        status: true,
        message: `Ajuan berhasil di-${status.toLowerCase()}. Notifikasi email sedang diproses.`,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },

  getPesertaDiterima: async (req, res, next) => {
    try {
      const daftarAjuanDiterima = await prisma.ajuanMagang.findMany({
        where: {
          statusUsulan: 'APPROVED',
          suratPenerimaan: null,
        },
        select: {
          id: true,
          peserta: {
            select: {
              id: true,
              namaLengkap: true,
              user: { select: { email: true } },
            },
          },
          bidang: {
            select: { nama: true },
          },
        },
        orderBy: {
          peserta: { namaLengkap: 'asc' },
        },
      });

      const formattedData = daftarAjuanDiterima.map((ajuan) => ({
        ajuanId: ajuan.id,
        pesertaId: ajuan.peserta.id,
        nama: ajuan.peserta.namaLengkap,
        email: ajuan.peserta.user.email,
        bidang: ajuan.bidang.nama,
      }));

      res.status(200).json({
        status: true,
        message: 'Data peserta diterima berhasil diambil.',
        data: formattedData,
      });
    } catch (error) {
      next(error);
    }
  },

  kirimSuratPenerimaan: async (req, res, next) => {
    try {
      const { ajuanId, noSurat } = req.body;
      const { fileUrl, fileId } = req.body;
      const pdfBuffer = req.file?.buffer;

      if (!ajuanId || !noSurat || !fileUrl || !fileId || !pdfBuffer) {
        return res.status(400).json({
          status: false,
          message:
            'Data tidak lengkap. Pastikan ajuan, no surat, dan file disertakan.',
        });
      }

      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        select: {
          id: true,
          statusUsulan: true,
          tglMulai: true,
          tglSelesai: true,
          peserta: {
            select: {
              namaLengkap: true,
              user: { select: { email: true } },
            },
          },
          bidang: { select: { nama: true } },
          suratPenerimaan: true,
        },
      });

      if (!ajuan) {
        return res
          .status(404)
          .json({ status: false, message: 'Ajuan Magang tidak ditemukan.' });
      }
      if (ajuan.statusUsulan !== 'APPROVED') {
        return res.status(400).json({
          status: false,
          message: 'Ajuan ini belum berstatus DITERIMA (APPROVED).',
        });
      }
      if (ajuan.suratPenerimaan) {
        return res.status(400).json({
          status: false,
          message: 'Surat penerimaan untuk ajuan ini sudah pernah dikirim.',
        });
      }

      await prisma.suratPenerimaan.create({
        data: {
          noSurat: noSurat,
          fileUrl: fileUrl,
          fileId: fileId,
          ajuanId: ajuanId,
        },
      });

      const emailPeserta = ajuan.peserta.user.email;
      const namaPeserta = ajuan.peserta.namaLengkap;
      const emailSubject = `Selamat! Anda Diterima Magang di Diskominfo Sidoarjo 🎉`;

      if (!emailPeserta) {
        console.error(
          `Email tidak ditemukan untuk peserta ${namaPeserta} (Ajuan ID: ${ajuanId})`
        );
        return res.status(201).json({
          status: true,
          message:
            'Surat berhasil diunggah dan disimpan. PERINGATAN: Email gagal dikirim (email peserta tidak ditemukan).',
        });
      }

      const templatePath = path.join(
        __dirname,
        '../views/sendInternLetter.ejs'
      );

      const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      };

      const templateData = {
        namaLengkap: namaPeserta,
        namaBidang: ajuan.bidang.nama,
        tanggalMulai: formatDate(ajuan.tglMulai),
        tanggalSelesai: formatDate(ajuan.tglSelesai),
      };

      const html = await ejs.renderFile(templatePath, templateData);

      const attachment = {
        filename: `Surat_Penerimaan_${namaPeserta.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      };

      await sendEmail({
        from: process.env.SENDER_GMAIL,
        to: emailPeserta,
        subject: emailSubject,
        html: html,
        attachments: [attachment],
      });

      res.status(201).json({
        status: true,
        message:
          'Surat penerimaan berhasil diunggah, disimpan, dan dikirim ke email peserta.',
      });
    } catch (error) {
      next(error);
    }
  },

  getAllRiwayatSurat: async (req, res, next) => {
    try {
      const { search, bidang, date } = req.query;

      const where = {};

      if (search) {
        where.ajuan = {
          peserta: {
            namaLengkap: { contains: search, mode: 'insensitive' },
          },
        };
      }

      if (bidang && bidang !== 'Semua') {
        where.ajuan = {
          ...where.ajuan,
          bidang: {
            nama: bidang,
          },
        };
      }

      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);

        where.createdAt = {
          gte: startDate,
          lt: endDate,
        };
      }

      const riwayat = await prisma.suratPenerimaan.findMany({
        where: where,
        select: {
          id: true,
          noSurat: true,
          createdAt: true,
          fileUrl: true,
          ajuan: {
            select: {
              peserta: {
                select: {
                  namaLengkap: true,
                  user: { select: { email: true } },
                },
              },
              bidang: {
                select: { nama: true },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const formattedData = riwayat.map((item) => ({
        id: item.id,
        namaPeserta: item.ajuan.peserta.namaLengkap,
        email: item.ajuan.peserta.user.email,
        bidang: item.ajuan.bidang.nama,
        noSurat: item.noSurat,
        tanggal: item.createdAt,
        fileUrl: item.fileUrl,
      }));

      res.status(200).json({
        status: true,
        message: 'Riwayat surat berhasil diambil.',
        data: formattedData,
      });
    } catch (error) {
      next(error);
    }
  },

  getPublicAjuanList: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, status, bidang } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);
      let whereClause = {};

      if (status) {
        const statusMap = {
          PENDING: 'PENDING',
          DITERIMA: 'APPROVED',
          DITOLAK: 'REJECTED',
        };

        const prismaStatus = statusMap[status.toUpperCase()];

        if (prismaStatus) {
          whereClause.statusUsulan = prismaStatus;
        }
      }

      if (bidang) {
        whereClause.bidang = {
          nama: { contains: bidang },
        };
      }

      const [ajuanList, totalItems] = await prisma.$transaction([
        prisma.ajuanMagang.findMany({
          where: whereClause,
          select: {
            id: true,
            temaMagang: true,
            statusUsulan: true,
            tglMulai: true,
            tglSelesai: true,
            createdAt: true,
            peserta: {
              select: {
                namaLengkap: true,
              },
            },
            bidang: {
              select: {
                nama: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: skip,
          take: take,
        }),
        prisma.ajuanMagang.count({ where: whereClause }),
      ]);

      const transformedData = ajuanList.map((ajuan) => ({
        nama: ajuan.peserta.namaLengkap,
        tema: ajuan.temaMagang,
        bidang: ajuan.bidang.nama,
        status:
          ajuan.statusUsulan === 'APPROVED'
            ? 'DITERIMA'
            : ajuan.statusUsulan === 'REJECTED'
            ? 'DITOLAK'
            : 'Diproses',
        tglMulai: ajuan.tglMulai,
        tglSelesai: ajuan.tglSelesai,
        createdAt: ajuan.createdAt,
      }));

      res.status(200).json({
        status: true,
        message: 'Daftar usulan magang publik berhasil diambil.',
        data: transformedData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalItems / take),
          totalItems: totalItems,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
