const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../utils/sendEmail');

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
        where: {
          pesertaId: peserta.id,
        },
        include: {
          bidang: {
            select: { id: true, nama: true }, // Ambil nama bidang
          },
        },
        orderBy: {
          createdAt: 'desc', // Tampilkan yang terbaru di atas
        },
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
          // Ambil nama bidang
          bidang: {
            select: {
              nama: true,
            },
          },
          // Ambil data peserta (yang memiliki data ajuan ini)
          peserta: {
            include: {
              // Ambil juga data berkas milik peserta tersebut
              // Kita ambil 1 berkas terbaru (sesuai logika 'createAjuanMagang')
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

      // 5. Validasi Keamanan: Cek jika peserta yang login = pemilik ajuan
      // Ini memastikan peserta A tidak bisa melihat detail ajuan milik peserta B
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
          { temaMagang: { contains: search, mode: 'insensitive' } }, // mode: 'insensitive' untuk case-insensitive
          { instansi: { contains: search, mode: 'insensitive' } },
          { jurusan: { contains: search, mode: 'insensitive' } },
          {
            peserta: {
              namaLengkap: { contains: search, mode: 'insensitive' },
            },
          },
          {
            bidang: {
              nama: { contains: search, mode: 'insensitive' },
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
          include: {
            peserta: {
              select: {
                namaLengkap: true,
                nimNis: true,
                user: { select: { email: true } },
              },
            },
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
      const { status, alasanPenolakan } = req.body;

      if (!['DITERIMA', 'DITOLAK'].includes(status)) {
        return res.status(400).json({
          status: false,
          message: "Status harus 'DITERIMA' atau 'DITOLAK'.",
          data: null,
        });
      }

      // 1. Ambil data ajuan
      const ajuan = await prisma.ajuanMagang.findUnique({
        where: { id: ajuanId },
        include: {
          peserta: {
            select: {
              id: true,
              namaLengkap: true,
              user: { select: { email: true } },
            },
          },
          bidang: {
            select: { id: true, nama: true }, // Ambil ID bidang juga
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

      // 2. Cek Kuota jika DITERIMA
      if (status === 'DITERIMA' && ajuan.statusUsulan !== 'DITERIMA') {
        const kuotaTersedia = await cekKuota(ajuan.bidang.id); // Gunakan ajuan.bidang.id
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
          where: { id: ajuan.peserta.id }, // Gunakan ajuan.peserta.id
          data: {
            status: statusPesertaEnum,
            ...(status === 'DITERIMA' && { bidangId: ajuan.bidang.id }),
          },
        });
      });

      // 5. Kirim Email Notifikasi Status
      const { email: emailPeserta } = ajuan.peserta.user;
      const { namaLengkap: namaPeserta } = ajuan.peserta;
      const { nama: namaBidang } = ajuan.bidang;

      let emailSubject = '';
      let emailBody = '';

      if (status === 'DITERIMA') {
        emailSubject = 'Selamat! Ajuan Magang Anda Diterima';
        emailBody = `<p>Halo ${namaPeserta},</p><p>Kami senang memberitahukan bahwa ajuan magang Anda untuk bidang <strong>${namaBidang}</strong> telah <strong>DITERIMA</strong>.</p><p>Informasi lebih lanjut mengenai jadwal dan surat penerimaan resmi akan kami kirimkan dalam email terpisah.</p><p>Terima kasih.</p>`;
      } else {
        emailSubject = 'Informasi Status Ajuan Magang Anda';
        emailBody = `<p>Halo ${namaPeserta},</p><p>Setelah meninjau ajuan magang Anda untuk bidang <strong>${namaBidang}</strong>, dengan berat hati kami sampaikan bahwa ajuan Anda <strong>DITOLAK</strong>.</p>${
          alasanPenolakan
            ? `<p><strong>Alasan:</strong> ${alasanPenolakan}</p>`
            : ''
        }<p>Terima kasih atas minat Anda.</p>`;
      }

      // Kirim email (tanpa perlu 'await' agar respons lebih cepat)
      sendEmail(emailPeserta, emailSubject, emailBody).catch((err) => {
        console.error('Gagal mengirim email notifikasi status:', err);
      });

      res.status(200).json({
        status: true,
        message: `Ajuan berhasil di-${status.toLowerCase()}. Notifikasi email telah dikirim.`,
        data: null,
      });
    } catch (error) {
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
};
