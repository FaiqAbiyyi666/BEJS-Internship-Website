const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');
const ejs = require('ejs');
const path = require('path');

const cekKuota = async (bidangId) => {
  // Validasi input. ID tidak boleh null, undefined, atau string kosong.
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
    // Menangkap error jika 'bidangId' bukan UUID yang valid
    console.error('Error Prisma saat mencari bidang:', prismaError.message);
    throw new Error(
      `Format ID Bidang tidak valid. Pastikan Anda mengirim UUID.`
    );
  }

  if (!bidang) {
    // Ini error logis: ID-nya valid tapi tidak ada di DB
    throw new Error(
      `Bidang tidak ditemukan. ID (${bidangId}) tidak ada di database.`
    );
  }

  try {
    const jumlahDiterima = await prisma.ajuanMagang.count({
      where: {
        bidangId: bidangId,
        statusUsulan: 'DITERIMA',
      },
    });
    return jumlahDiterima < bidang.kuota;
  } catch (countError) {
    // Ini error saat menghitung
    console.error('Error saat menghitung jumlah ajuan:', countError);
    // Anggap penuh jika gagal menghitung
    throw new Error(`Gagal menghitung kuota: ${countError.message}`);
  }
};

module.exports = {
  createAjuanMagang: async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          // 401 Unauthorized
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

      if (!berkas_urls || Object.keys(berkas_urls).length === 0) {
        return res.status(400).json({
          status: false,
          message: 'Upload berkas gagal atau tidak lengkap.',
          data: null,
        });
      }

      const dataUntukDb = {
        peserta_namaLengkap: namaLengkap,
        peserta_nimNis: nis_nim,
        peserta_instansi: instansi,
        peserta_jurusan: jurusan,

        // Untuk tabel AjuanMagang
        ajuan_kategoriMagang: kategori,
        ajuan_statusPendidikan: statusPendidikan,
        ajuan_jenjangPendidikan: jenjangPendidikan,
        ajuan_instansi: instansi,
        ajuan_jurusan: jurusan,
        ajuan_tglMulai: new Date(durasiMulai),
        ajuan_tglSelesai: new Date(durasiSelesai),
        ajuan_temaMagang: tema,
        ajuan_bidangId: bidangPilihan,

        // Untuk tabel BerkasMagang (dari middleware 'uploadBerkasAjuan')
        berkas_suratPengantar: berkas_urls.surat_pengantar,
        berkas_proposalMagang: berkas_urls.proposal_magang,
        berkas_cv: berkas_urls.cv,
        berkas_pasFoto: berkas_urls.ktp,
        berkas_bakesbangpolSda: berkas_urls.surat_bakesbang_sda,
        berkas_bakesbangpolSby: berkas_urls.surat_bakesbang_prov,
      };

      const ajuanBaru = await prisma.$transaction(async (tx) => {
        const peserta = await tx.pesertaMagang.update({
          where: { userId: userIdFromToken },
          data: {
            namaLengkap: dataUntukDb.peserta_namaLengkap,
            nimNis: dataUntukDb.peserta_nimNis,
            instansi: dataUntukDb.peserta_instansi,
            jurusan: dataUntukDb.peserta_jurusan,
          },
          select: { id: true },
        });

        // Langkah B: Cek Kuota Bidang
        const kuotaTersedia = await cekKuota(dataUntukDb.ajuan_bidangId);
        if (!kuotaTersedia) {
          throw new Error('Kuota untuk bidang ini sudah penuh.');
        }

        // Langkah C: Buat record AjuanMagang baru
        const ajuan = await tx.ajuanMagang.create({
          data: {
            kategoriMagang: dataUntukDb.ajuan_kategoriMagang,
            statusPendidikan: dataUntukDb.ajuan_statusPendidikan,
            jenjangPendidikan: dataUntukDb.ajuan_jenjangPendidikan,
            instansi: dataUntukDb.ajuan_instansi,
            jurusan: dataUntukDb.ajuan_jurusan,
            tglMulai: dataUntukDb.ajuan_tglMulai,
            tglSelesai: dataUntukDb.ajuan_tglSelesai,
            temaMagang: dataUntukDb.ajuan_temaMagang,
            statusUsulan: 'PENDING',
            peserta: { connect: { id: peserta.id } },
            bidang: { connect: { id: dataUntukDb.ajuan_bidangId } },
          },
        });

        await tx.berkasMagang.create({
          data: {
            suratPengantar: dataUntukDb.berkas_suratPengantar,
            proposalMagang: dataUntukDb.berkas_proposalMagang,
            cv: dataUntukDb.berkas_cv,
            pasFoto: dataUntukDb.berkas_pasFoto,
            suratBakesbangpolSda: dataUntukDb.berkas_bakesbangpolSda,
            suratBakesbangpolSby: dataUntukDb.berkas_bakesbangpolSby,
            peserta: { connect: { id: peserta.id } },
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
          message: 'Gagal memperbarui profil: Peserta magang tidak ditemukan.',
          data: null,
        });
      }

      next(error);
    }
  },

  /**
   * 2. PESERTA: Melihat Riwayat Ajuan Magang Milik Sendiri
   */
  getAjuanMagangByPeserta: async (req, res, next) => {
    console.log(
      '--- ENTERING getAjuanMagangByPeserta (VERSION WITH SELECT ID) ---'
    );
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message: 'Data pengguna tidak ditemukan dari token.',
          data: null,
        });
      }

      const userIdFromToken = req.user.id;

      // 1. Cari PesertaMagang ID
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

      // 2. Ambil semua ajuan magang milik peserta tsb
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

      console.log(
        'Data RIWAYAT AJUAN yang akan dikirim ke frontend:',
        JSON.stringify(riwayatAjuan, null, 2)
      );

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
      // 1. Validasi User dari Token
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: false,
          message: 'Autentikasi gagal. Token tidak valid.',
          data: null,
        });
      }
      const userIdFromToken = req.user.id;

      // 2. Ambil ID Ajuan dari parameter URL
      const { id: ajuanId } = req.params;
      if (!ajuanId) {
        return res
          .status(400)
          .json({ status: false, message: 'ID Ajuan diperlukan.', data: null });
      }

      // 3. Ambil data AjuanMagang dari database
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
          peserta: {
            include: {
              berkas: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
              },
            },
          },
        },
      });

      // 4. Validasi: Cek jika ajuan ada
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

      // 6. Kirim data
      res.status(200).json({
        status: true,
        message: 'Detail ajuan magang berhasil diambil.',
        data: ajuan,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * 3. ADMIN & SUBKOOR: Melihat Semua Usulan Magang yang Masuk
   */
  getAllAjuanMagang: async (req, res, next) => {
    try {
      const { role, userId } = req.user;
      const { status, search, page = 1, limit = 10 } = req.query;

      let whereClause = {};

      // A. Filter berdasarkan Role
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

      // B. Filter berdasarkan Status
      if (status && status !== 'all') {
        const validStatus = ['PENDING', 'DITERIMA', 'DITOLAK'];
        if (validStatus.includes(status.toUpperCase())) {
          whereClause.statusUsulan = status.toUpperCase();
        }
      }

      // C. Filter berdasarkan Pencarian
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

      // D. Setup Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // E. Ambil Data + Total
      const [ajuanList, totalItems] = await prisma.$transaction([
        prisma.ajuanMagang.findMany({
          where: whereClause,
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            // Data Ajuan
            instansi: true,
            jurusan: true,
            statusPendidikan: true,
            jenjangPendidikan: true,
            temaMagang: true,
            tglMulai: true,
            tglSelesai: true,
            statusUsulan: true,

            // Data Relasi Peserta
            peserta: {
              select: {
                id: true,
                namaLengkap: true,
                nimNis: true,
                user: { select: { email: true } },
                pasFoto: true,
                berkas: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
            // Data Relasi Bidang
            bidang: {
              select: { nama: true },
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

      // Kirim respons dengan style yang konsisten
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

  /**
   * 4. ADMIN & SUBKOOR: Memberi Balasan (ACC/Tolak) Usulan Magang
   */
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

      // 1. Ambil data ajuan (Query sudah DIPERBAIKI)
      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        // Gunakan 'select' untuk memastikan semua data terambil
        select: {
          id: true,
          statusUsulan: true, // Dibutuhkan untuk Cek Kuota

          // ======== PERBAIKAN 1: Ambil tanggal ========
          tglMulai: true,
          tglSelesai: true,
          // ==========================================

          peserta: {
            select: {
              id: true,
              namaLengkap: true,
              user: { select: { email: true } }, // Ambil email dari User
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

      // 2. Cek Kuota (Logic Anda)
      if (status === 'DITERIMA' && ajuan.statusUsulan !== 'DITERIMA') {
        const kuotaTersedia = await cekKuota(ajuan.bidang.id);
        if (!kuotaTersedia) {
          return res.status(400).json({
            status: false,
            message: 'Gagal menerima. Kuota untuk bidang ini sudah penuh.',
            data: null,
          });
        }
      }

      // 3. Siapkan data update
      const statusUsulanStr = status;
      const statusPesertaEnum = status === 'DITERIMA' ? 'APPROVED' : 'REJECTED';

      // 4. Gunakan Transaksi
      await prisma.$transaction(async (tx) => {
        await tx.ajuanMagang.update({
          where: { id: ajuanId },
          data: { statusUsulan: statusUsulanStr },
        });

        await tx.pesertaMagang.update({
          where: { id: ajuan.peserta.id },
          data: {
            status: statusPesertaEnum,
            ...(status === 'DITERIMA' && { bidangId: ajuan.bidang.id }),
          },
        });
      });

      // 5. Kirim Email Notifikasi Status
      const { email: emailPeserta } = ajuan.peserta.user;
      const { namaLengkap: namaPeserta } = ajuan.peserta;

      // ==========================================================
      // !! PERBAIKAN 2: Validasi email untuk error 'No recipients' !!
      // ==========================================================
      if (!emailPeserta) {
        console.error(
          `Gagal mengirim email: Email tidak ditemukan untuk peserta ${namaPeserta} (ID: ${ajuan.peserta.id})`
        );

        // Kirim respons sukses ke admin, tapi beri peringatan
        return res.status(200).json({
          status: true,
          message: `Ajuan berhasil di-${status.toLowerCase()}. PERINGATAN: Notifikasi email GAGAL terkirim (email peserta tidak terdaftar).`,
          data: null,
        });
      }
      // ==========================================================

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
        // DITOLAK
        emailSubject = 'Pemberitahuan Status Usulan Magang';
        templateData = {
          namaLengkap: namaPeserta,
          diterima: false,
          detail: {},
        };
      }

      // Tentukan path ke file template EJS Anda
      const templatePath = path.join(
        __dirname,
        '../views/sendNoticeInternProposal.ejs' // Path Anda
      );

      // Render file EJS menjadi string HTML
      ejs.renderFile(templatePath, templateData, (err, html) => {
        if (err) {
          console.error('Gagal me-render EJS untuk email:', err);
          // Jika render gagal, email tidak terkirim, tapi DB sudah update.
          // Respons sukses di bawah akan tetap terkirim.
        } else {
          // Kirim email (non-blocking)
          // ==========================================================
          // !! PERBAIKAN 3: Menggunakan 'sendMail' dan parameter Anda !!
          // ==========================================================
          sendEmail({
            from: process.env.SENDER_GMAIL,
            to: emailPeserta, // 'to' bukan 'email'
            subject: emailSubject,
            html: html, // 'html' bukan 'htmlEmail'
          }).catch((emailError) => {
            // Tangkap error pengiriman email di sini agar server tidak crash
            console.error(
              'Gagal mengirim email notifikasi status:',
              emailError
            );
          });
        }
      });

      // Kirim respons sukses ke admin (DB update berhasil)
      // Ini akan terkirim TANPA menunggu email selesai dikirim
      res.status(200).json({
        status: true,
        message: `Ajuan berhasil di-${status.toLowerCase()}. Notifikasi email sedang diproses.`,
        data: null,
      });
    } catch (error) {
      // Tangani error lain (DB, Kuota, dll)
      next(error);
    }
  },

  /**
   * 5. ADMIN & SUBKOOR: Mengirim Surat Penerimaan Magang
   */
  kirimSuratPenerimaan: async (req, res, next) => {
    try {
      const { id: ajuanId } = req.params;

      // 1. Ambil data lengkap untuk surat
      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        include: {
          peserta: {
            select: {
              namaLengkap: true,
              nimNis: true,
              instansi: true,
              jurusan: true,
              user: { select: { email: true } },
            },
          },
          bidang: {
            select: { nama: true },
          },
          // Sertakan data yang relevan untuk surat
          tglMulai: true,
          tglSelesai: true,
          temaMagang: true,
          statusUsulan: true,
        },
      });

      // 2. Validasi
      if (!ajuan || ajuan.statusUsulan !== 'DITERIMA') {
        return res.status(400).json({
          status: false,
          message:
            'Gagal mengirim surat. Pastikan ajuan magang ini telah berstatus "DITERIMA".',
          data: null,
        });
      }

      // 3. (Mock) Panggil service untuk generate PDF
      // Pastikan service 'generateSuratPenerimaanPDF' Anda mengembalikan buffer
      const pdfBuffer = await generateSuratPenerimaanPDF(ajuan);

      // 4. Siapkan data email
      const emailPeserta = ajuan.peserta.user.email;
      const namaPeserta = ajuan.peserta.namaLengkap;
      const emailSubject = 'Surat Penerimaan Magang Resmi';
      const emailBody = `<p>Halo ${namaPeserta},</p><p>Terlampir adalah Surat Penerimaan Magang resmi Anda.</p><p>Harap baca dokumen terlampir dengan saksama untuk informasi mengenai tanggal mulai, penempatan bidang, dan instruksi lebih lanjut.</p><p>Kami tunggu kehadiran Anda.</p><p>Terima kasih.</p>`;

      const attachment = {
        filename: `Surat_Penerimaan_Magang_${namaPeserta.replace(
          /\s+/g,
          '_'
        )}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      };

      await sendEmail(emailPeserta, emailSubject, emailBody, [attachment]);

      res.status(200).json({
        status: true,
        message: 'Surat penerimaan berhasil dikirim ke email peserta.',
        data: null,
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

      if (
        status &&
        ['PENDING', 'DITERIMA', 'DITOLAK'].includes(status.toUpperCase())
      ) {
        whereClause.statusUsulan = status.toUpperCase();
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
            createdAt: true, // <-- PASTIKAN INI ADA
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

      // Transformasi data TANPA format TANGGAL dan PERIODE
      const transformedData = ajuanList.map((ajuan) => ({
        nama: ajuan.peserta.namaLengkap,
        // --- TANGGAL DIHAPUS DARI SINI ---
        tema: ajuan.temaMagang,
        bidang: ajuan.bidang.nama,
        status:
          ajuan.statusUsulan === 'PENDING' ? 'Diproses' : ajuan.statusUsulan,
        // Kirim tanggal mentah
        tglMulai: ajuan.tglMulai,
        tglSelesai: ajuan.tglSelesai,
        createdAt: ajuan.createdAt, // <-- KIRIM INI MENTAH
      }));

      res.status(200).json({
        status: true,
        message: 'Daftar usulan magang publik berhasil diambil.',
        data: transformedData, // Data sekarang berisi createdAt mentah
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
