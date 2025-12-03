const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ====================================================================
// KONSTANTA FILE DUMMY (dari ImageKit)
// ====================================================================
const DUMMY_FILES = {
  LAPORAN_AKHIR:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/laporan_akhir.pdf?updatedAt=1762706162711',
  LOGBOOK:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/logbook.pdf?updatedAt=1762706022775',
  SERTIFIKAT:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/sertifikat.pdf?updatedAt=1762705951749',
  SURAT_PENERIMAAN:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/surat_magang.pdf?updatedAt=1762705844512',
  SURAT_PENGANTAR:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/surat_pengantar.pdf?updatedAt=1762705806248',
  CV: 'https://ik.imagekit.io/magangdiskominfo/data_dummy/cv_dummy.pdf?updatedAt=1762705568296',
  KTP: 'https://ik.imagekit.io/magangdiskominfo/data_dummy/ktp_dummy.pdf?updatedAt=1762705456578',
  BAKESBANGPOL_PROV:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/bakesbangpol_prov.pdf?updatedAt=1762705479697',
  BAKESBANGPOL_SDA:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/bakesbangpol_sda.pdf?updatedAt=1762705196337',
  PROPOSAL_MAGANG:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/proposal_magang.pdf?updatedAt=1762705169999',
  PP_CEWEK:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/pp_cewek_dummy.png?updatedAt=1762707176737',
  PP_COWOK:
    'https://ik.imagekit.io/magangdiskominfo/data_dummy/pp_cowok_dummy.png?updatedAt=1762707176437',
  FOTO_KTP_REGIS:
    'https://ik.imagekit.io/magangdiskominfo/ktp/ktp_dummy_foto.jpg',
};

// ====================================================================
// HELPER FUNCTIONS
// ====================================================================

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function getDates() {
  const today = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  // Periode 3 minggu (21 hari)
  const threeWeeksAgo = new Date(today.getTime() - 21 * oneDay);
  const oneWeekAgo = new Date(today.getTime() - 7 * oneDay);
  const yesterday = new Date(today.getTime() - 1 * oneDay);
  const nextTwoWeeks = new Date(today.getTime() + 14 * oneDay);

  // Tanggal spesifik untuk logbook tidak lengkap
  const tenDaysAgo = new Date(today.getTime() - 10 * oneDay);

  return {
    today,
    yesterday,
    oneWeekAgo,
    threeWeeksAgo,
    nextTwoWeeks,
    tenDaysAgo,
  };
}

function createDummyBerkas() {
  return {
    suratPengantar: DUMMY_FILES.SURAT_PENGANTAR,
    proposalMagang: DUMMY_FILES.PROPOSAL_MAGANG,
    cv: DUMMY_FILES.CV,
    ktp: DUMMY_FILES.KTP,
    suratBakesbangpolSda: DUMMY_FILES.BAKESBANGPOL_SDA,
    suratBakesbangpolProv: DUMMY_FILES.BAKESBANGPOL_PROV,
  };
}

// FUNGSI LOGBOOK DIPERBARUI
async function generateLogbookEntries(ajuanId, tglMulai, tglSelesai) {
  console.log(`Mengisi logbook 7 HARI/MINGGU untuk ajuan ${ajuanId}...`);
  const logEntries = [];
  let currentDate = new Date(tglMulai);
  const endDate = new Date(tglSelesai);
  const oneDay = 24 * 60 * 60 * 1000;

  const deskripsiAcak = [
    'Mempelajari alur kerja sistem',
    'Rapat harian dan pembagian tugas',
    'Melakukan perbaikan bug pada fitur X',
    'Membuat dokumentasi teknis',
    'Mengerjakan modul login',
    'Review kode dengan mentor',
    'Presentasi progres mingguan',
  ];

  while (currentDate <= endDate) {
    // PERUBAHAN: Dihapus pengecekan 'dayOfWeek', sekarang 7 hari kerja
    logEntries.push({
      ajuanId: ajuanId,
      tanggal: new Date(currentDate),
      deskripsi:
        deskripsiAcak[Math.floor(Math.random() * deskripsiAcak.length)],
      // PERUBAHAN: File logbook sekarang WAJIB, tidak lagi null
      logbookFile: DUMMY_FILES.LOGBOOK,
    });
    // Maju ke hari berikutnya
    currentDate = new Date(currentDate.getTime() + oneDay);
  }

  if (logEntries.length > 0) {
    await prisma.logbook.createMany({
      data: logEntries,
    });
    console.log(`-> ${logEntries.length} logbook (7-day/week) terisi.`);
  }
}

// ====================================================================
// FUNGSI UTAMA SEEDING
// ====================================================================
async function main() {
  console.log('🌱 Memulai proses seeding...');
  const {
    today,
    yesterday,
    oneWeekAgo,
    threeWeeksAgo,
    nextTwoWeeks,
    tenDaysAgo,
  } = getDates();
  const defaultPassword = await hashPassword('password123');

  // 1. 🧹 HAPUS DATA LAMA
  console.log('Membersihkan data lama...');
  await prisma.logbook.deleteMany();
  await prisma.laporanHasilMagang.deleteMany();
  await prisma.sertifikat.deleteMany();
  await prisma.ulasanMagang.deleteMany();
  await prisma.suratPenerimaan.deleteMany();
  await prisma.berkasMagang.deleteMany();
  await prisma.notifikasi.deleteMany();
  await prisma.kritikSaran.deleteMany();
  await prisma.ajuanMagang.deleteMany();
  await prisma.pesertaMagang.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.subKoordinatorBidang.deleteMany();
  await prisma.user.deleteMany();
  await prisma.kuotaBidang.deleteMany();

  // 2. 🏢 BUAT KUOTA BIDANG
  console.log('Membuat Kuota Bidang...');
  const bidangInfra = await prisma.kuotaBidang.create({
    data: { nama: 'Infrastruktur dan Keamanan TIK', kuota: 10 },
  });
  const bidangPikp = await prisma.kuotaBidang.create({
    data: { nama: 'Pengelolaan Informasi dan Komunikasi Publik', kuota: 10 },
  });
  const bidangSekre = await prisma.kuotaBidang.create({
    data: { nama: 'Sekretariat', kuota: 10 },
  });
  const bidangStat = await prisma.kuotaBidang.create({
    data: { nama: 'Statistik', kuota: 10 },
  });
  const bidangTatakelola = await prisma.kuotaBidang.create({
    data: { nama: 'Tata Kelola Informatika', kuota: 10 },
  });

  // 3. 🧑‍💼 BUAT ADMIN & SUBKOORDINATOR
  console.log('Membuat Admin & Subkoordinator...');
  await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: defaultPassword,
      role: 'admin',
      admin: { create: { nama: 'Admin Utama', bidangId: bidangTatakelola.id } },
    },
  });
  await prisma.user.create({
    data: {
      email: 'subkoor.pikp@test.com',
      password: defaultPassword,
      role: 'sub_koordinator_bidang',
      subKoordinatorBidang: {
        create: { nama: 'Subkoor PIKP', bidangId: bidangPikp.id },
      },
    },
  });

  // 4. 👤 BUAT DATA DUMMY PESERTA MAGANG
  // Skenario alur kerja (workflow) Anda dimulai dari Kriteria 4

  // --- Kriteria 1: Registrasi, belum di-approve (PENDING) ---
  console.log('Membuat Kriteria 1 (Pending Approval)...');
  await prisma.user.create({
    data: {
      email: 'peserta.pending@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Budi Pending',
          tglLahir: new Date('2002-05-10T00:00:00Z'),
          noTelepon: '081234567890',
          nik: '1234567890123456',
          nimNis: '112233112233',
          instansi: 'Universitas Pending',
          jurusan: 'Teknik Informatika',
          alamat: 'Jl. Merdeka No. 1',
          instagram: 'budipending',
          pasFoto: DUMMY_FILES.PP_COWOK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'PENDING',
        },
      },
    },
  });

  // --- Kriteria 2: Sudah di-approve, belum mengajukan magang ---
  console.log('Membuat Kriteria 2 (Approved, Belum Ajuan)...');
  await prisma.user.create({
    data: {
      email: 'peserta.approved@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Ani Approved',
          tglLahir: new Date('2001-11-20T00:00:00Z'),
          noTelepon: '081211112222',
          nik: '0987654321098765',
          nimNis: '445566445566',
          instansi: 'Universitas Setuju',
          jurusan: 'Ilmu Komunikasi',
          alamat: 'Jl. Damai No. 2',
          instagram: 'aniapproved',
          pasFoto: DUMMY_FILES.PP_CEWEK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangPikp.id,
        },
      },
    },
  });

  // --- Kriteria 3: Ajuan diterima, magang sedang berjalan ---
  console.log('Membuat Kriteria 3 (Magang Aktif, Belum Selesai)...');
  const user3 = await prisma.user.create({
    data: {
      email: 'peserta.aktif@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Candra Aktif',
          tglLahir: new Date('2003-01-15T00:00:00Z'),
          noTelepon: '081233334444',
          nik: '1122334455667788',
          nimNis: '778899445566',
          instansi: 'Politeknik Negeri',
          jurusan: 'Manajemen Informatika',
          alamat: 'Jl. Sejahtera No. 3',
          instagram: 'candraaktif',
          pasFoto: DUMMY_FILES.PP_COWOK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangTatakelola.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanCandra = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'D3',
      instansi: 'Politeknik Negeri',
      jurusan: 'Manajemen Informatika',
      tglMulai: oneWeekAgo, // Mulai 1 minggu lalu
      tglSelesai: nextTwoWeeks, // Selesai 2 minggu lagi
      temaMagang: 'Pengembangan Sistem Internal',
      statusUsulan: 'APPROVED',
      pesertaId: user3.pesertaMagang.id,
      bidangId: bidangTatakelola.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '123/SP/TI/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file123',
        },
      },
    },
  });
  // Logbook baru terisi sebagian (karena magang masih aktif)
  await generateLogbookEntries(ajuanCandra.id, oneWeekAgo, today);

  // --- Kriteria 4: Siap Kirim Laporan (Logbook Penuh, Magang Selesai) ---
  console.log('Membuat Kriteria 4 (Siap Kirim Laporan Akhir)...');
  const user4 = await prisma.user.create({
    data: {
      email: 'peserta.siap.laporan@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Dina Siap Laporan',
          tglLahir: new Date('2000-08-30T00:00:00Z'),
          noTelepon: '081255556666',
          nik: '9988776655443322',
          nimNis: '101010445566',
          instansi: 'Universitas Veteran',
          jurusan: 'Sistem Informasi',
          alamat: 'Jl. Pahlawan No. 4',
          instagram: 'dinalap',
          pasFoto: DUMMY_FILES.PP_CEWEK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangInfra.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanDina = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Veteran',
      jurusan: 'Sistem Informasi',
      tglMulai: threeWeeksAgo, // Selesai
      tglSelesai: yesterday, // Selesai
      temaMagang: 'Analisis Keamanan Jaringan',
      statusUsulan: 'APPROVED',
      pesertaId: user4.pesertaMagang.id,
      bidangId: bidangInfra.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '124/SP/INFRA/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file124',
        },
      },
      // Laporan, Ulasan, Sertifikat KOSONG
    },
  });
  // LOGBOOK DIISI PENUH (7 hari/minggu)
  await generateLogbookEntries(ajuanDina.id, threeWeeksAgo, yesterday);

  // --- Kriteria 5: Gagal Kirim Laporan (Logbook TDK Penuh, Magang Selesai) ---
  console.log('Membuat Kriteria 5 (Gagal Laporan - Logbook Kurang)...');
  const user5 = await prisma.user.create({
    data: {
      email: 'peserta.logbook.kurang@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Joko Logbook Kurang',
          tglLahir: new Date('2000-10-10T00:00:00Z'),
          noTelepon: '081210102020',
          nik: '1020304050607080',
          nimNis: '101010445566',
          instansi: 'Universitas Nasional',
          jurusan: 'Administrasi Publik',
          alamat: 'Jl. Kemerdekaan No. 10',
          instagram: 'jokologbook',
          pasFoto: DUMMY_FILES.PP_COWOK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangSekre.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanJoko = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Nasional',
      jurusan: 'Administrasi Publik',
      tglMulai: threeWeeksAgo, // Selesai
      tglSelesai: yesterday, // Selesai
      temaMagang: 'Pengarsipan Digital',
      statusUsulan: 'APPROVED',
      pesertaId: user5.pesertaMagang.id,
      bidangId: bidangSekre.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '130/SP/SEKRE/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file130',
        },
      },
      // Laporan, Ulasan, Sertifikat KOSONG
    },
  });
  // LOGBOOK SENGAJA DIISI SEBAGIAN (hanya 10 hari terakhir)
  await generateLogbookEntries(ajuanJoko.id, tenDaysAgo, yesterday); // Periode magang 21 hari, dia hanya isi 10

  // --- Kriteria 6: Siap Kirim Ulasan (Logbook Penuh, Laporan Approved) ---
  console.log('Membuat Kriteria 6 (Siap Kirim Ulasan)...');
  const user6 = await prisma.user.create({
    data: {
      email: 'peserta.siap.ulasan@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Lina Siap Ulasan',
          tglLahir: new Date('2002-12-12T00:00:00Z'),
          noTelepon: '081212124444',
          nik: '1212121212121212',
          nimNis: '123123445566',
          instansi: 'Universitas Brawijaya',
          jurusan: 'Ilmu Komputer',
          alamat: 'Jl. Soekarno Hatta No. 12',
          instagram: 'linalinu',
          pasFoto: DUMMY_FILES.PP_CEWEK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangTatakelola.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanLina = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Brawijaya',
      jurusan: 'Ilmu Komputer',
      tglMulai: threeWeeksAgo, // Selesai
      tglSelesai: yesterday, // Selesai
      temaMagang: 'Pengembangan Aplikasi',
      statusUsulan: 'APPROVED',
      pesertaId: user6.pesertaMagang.id,
      bidangId: bidangTatakelola.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '132/SP/TATA/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file132',
        },
      },
      laporan: {
        create: {
          fileLaporan: DUMMY_FILES.LAPORAN_AKHIR,
          status: 'APPROVED',
          catatan: 'Laporan diterima, baik.',
        },
      },
      // Ulasan & Sertifikat KOSONG
    },
  });
  // LOGBOOK DIISI PENUH
  await generateLogbookEntries(ajuanLina.id, threeWeeksAgo, yesterday);

  // --- Kriteria 7: Siap Kirim Sertifikat (Logbook Penuh, Laporan Approved, Ulasan Terisi) ---
  console.log('Membuat Kriteria 7 (Siap Kirim Sertifikat)...');
  const user7 = await prisma.user.create({
    data: {
      email: 'peserta.siap.sertifikat@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Kamal Siap Sertifikat',
          tglLahir: new Date('2001-11-11T00:00:00Z'),
          noTelepon: '081211113333',
          nik: '1122112211221122',
          nimNis: '111111445566',
          instansi: 'Universitas Indonesia',
          jurusan: 'Sistem Informasi',
          alamat: 'Jl. Merdeka No. 11',
          instagram: 'kamalsiap',
          pasFoto: DUMMY_FILES.PP_COWOK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangStat.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanKamal = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Indonesia',
      jurusan: 'Sistem Informasi',
      tglMulai: threeWeeksAgo, // Selesai
      tglSelesai: oneWeekAgo, // Selesai
      temaMagang: 'Digitalisasi Arsip',
      statusUsulan: 'APPROVED',
      pesertaId: user7.pesertaMagang.id,
      bidangId: bidangStat.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '131/SP/STAT/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file131',
        },
      },
      laporan: {
        create: {
          fileLaporan: DUMMY_FILES.LAPORAN_AKHIR,
          status: 'APPROVED',
          catatan: 'Baik dan tepat waktu.',
        },
      },
      ulasan: {
        create: {
          ulasan: 'Sangat profesional. Mentor membimbing dengan baik.',
          rating: 5,
        },
      },
      // 'sertifikat' SENGANJA DIKOSONGKAN
    },
  });
  // LOGBOOK DIISI PENUH
  await generateLogbookEntries(ajuanKamal.id, threeWeeksAgo, oneWeekAgo);

  // --- Kriteria 8 (5 Peserta Selesai 100% untuk Data Ulasan) ---
  console.log('Membuat Kriteria 8 (Data Ulasan 1/5)...');
  const user8 = await prisma.user.create({
    data: {
      email: 'peserta.selesai.1@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Eka Selesai',
          tglLahir: new Date('2001-04-25T00:00:00Z'),
          noTelepon: '081277778888',
          nik: '5566778899001122',
          nimNis: '987654445566',
          instansi: 'Institut Teknologi',
          jurusan: 'Ilmu Komputer',
          alamat: 'Jl. Juang No. 5',
          instagram: 'ekaselesai',
          pasFoto: DUMMY_FILES.PP_CEWEK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangStat.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanEka = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Institut Teknologi',
      jurusan: 'Ilmu Komputer',
      tglMulai: threeWeeksAgo,
      tglSelesai: oneWeekAgo,
      temaMagang: 'Analisis Data Statistik Kependudukan',
      statusUsulan: 'APPROVED',
      pesertaId: user8.pesertaMagang.id,
      bidangId: bidangStat.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '125/SP/STAT/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file125',
        },
      },
      laporan: {
        create: {
          fileLaporan: DUMMY_FILES.LAPORAN_AKHIR,
          status: 'APPROVED',
          catatan: 'Laporan sangat baik.',
        },
      },
      sertifikat: {
        create: {
          noSertifikat: 'SRT/2025/001',
          nilai: 95,
          fileUrl: DUMMY_FILES.SERTIFIKAT,
        },
      },
      ulasan: {
        create: {
          ulasan:
            'Pengalaman magang yang luar biasa! Pembimbing sangat membantu dan materi relevan.',
          rating: 5,
        },
      },
    },
  });
  await generateLogbookEntries(ajuanEka.id, threeWeeksAgo, oneWeekAgo);

  console.log('Membuat Kriteria 8 (Data Ulasan 2/5)...');
  const user9 = await prisma.user.create({
    data: {
      email: 'peserta.selesai.2@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Fajar Baik',
          tglLahir: new Date('2002-02-02T00:00:00Z'),
          noTelepon: '081266665555',
          nik: '1111222233334444',
          nimNis: '121212445566',
          instansi: 'Universitas Airlangga',
          jurusan: 'Humas',
          alamat: 'Jl. Dharmawangsa No. 6',
          instagram: 'fajarbaik',
          pasFoto: DUMMY_FILES.PP_COWOK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangPikp.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanFajar = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Airlangga',
      jurusan: 'Humas',
      tglMulai: threeWeeksAgo,
      tglSelesai: oneWeekAgo,
      temaMagang: 'Pengelolaan Media Sosial',
      statusUsulan: 'APPROVED',
      pesertaId: user9.pesertaMagang.id,
      bidangId: bidangPikp.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '126/SP/PIKP/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file126',
        },
      },
      laporan: {
        create: {
          fileLaporan: DUMMY_FILES.LAPORAN_AKHIR,
          status: 'APPROVED',
          catatan: 'Cukup baik.',
        },
      },
      sertifikat: {
        create: {
          noSertifikat: 'SRT/2025/002',
          nilai: 85,
          fileUrl: DUMMY_FILES.SERTIFIKAT,
        },
      },
      ulasan: {
        create: {
          ulasan:
            'Tempatnya nyaman, orang-orangnya ramah. Dapat banyak ilmu baru tentang kehumasan.',
          rating: 4,
        },
      },
    },
  });
  await generateLogbookEntries(ajuanFajar.id, threeWeeksAgo, oneWeekAgo);

  console.log('Membuat Kriteria 8 (Data Ulasan 3/5)...');
  const user10 = await prisma.user.create({
    data: {
      email: 'peserta.selesai.3@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Gita Cukup',
          tglLahir: new Date('2003-03-03T00:00:00Z'),
          noTelepon: '081277774444',
          nik: '5555666677778888',
          nimNis: '343434445566',
          instansi: 'Politeknik Elektronika',
          jurusan: 'Sekretaris',
          alamat: 'Jl. Mulyosari No. 7',
          instagram: 'gitacukup',
          pasFoto: DUMMY_FILES.PP_CEWEK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangSekre.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanGita = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'D3',
      instansi: 'Politeknik Elektronika',
      jurusan: 'Sekretaris',
      tglMulai: threeWeeksAgo,
      tglSelesai: oneWeekAgo,
      temaMagang: 'Administrasi Perkantoran',
      statusUsulan: 'APPROVED',
      pesertaId: user10.pesertaMagang.id,
      bidangId: bidangSekre.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '127/SP/SEKRE/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file127',
        },
      },
      laporan: {
        create: {
          fileLaporan: DUMMY_FILES.LAPORAN_AKHIR,
          status: 'APPROVED',
          catatan: 'Sudah sesuai.',
        },
      },
      sertifikat: {
        create: {
          noSertifikat: 'SRT/2025/003',
          nilai: 80,
          fileUrl: DUMMY_FILES.SERTIFIKAT,
        },
      },
      ulasan: {
        create: {
          ulasan:
            'Secara keseluruhan baik, namun kadang tugas kurang menantang.',
          rating: 3,
        },
      },
    },
  });
  await generateLogbookEntries(ajuanGita.id, threeWeeksAgo, oneWeekAgo);

  console.log('Membuat Kriteria 8 (Data Ulasan 4/5)...');
  const user11 = await prisma.user.create({
    data: {
      email: 'peserta.selesai.4@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Hadi Mantap',
          tglLahir: new Date('2001-08-17T00:00:00Z'),
          noTelepon: '081288883333',
          nik: '9999000011112222',
          nimNis: '565656445566',
          instansi: 'Universitas Pembangunan',
          jurusan: 'Teknik Informatika',
          alamat: 'Jl. Rungkut No. 8',
          instagram: 'hadimantap',
          pasFoto: DUMMY_FILES.PP_COWOK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangInfra.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanHadi = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Pembangunan',
      jurusan: 'Teknik Informatika',
      tglMulai: threeWeeksAgo,
      tglSelesai: oneWeekAgo,
      temaMagang: 'Pemeliharaan Jaringan',
      statusUsulan: 'APPROVED',
      pesertaId: user11.pesertaMagang.id,
      bidangId: bidangInfra.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '128/SP/INFRA/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file128',
        },
      },
      laporan: {
        create: {
          fileLaporan: DUMMY_FILES.LAPORAN_AKHIR,
          status: 'APPROVED',
          catatan: 'Luar biasa.',
        },
      },
      sertifikat: {
        create: {
          noSertifikat: 'SRT/2025/004',
          nilai: 98,
          fileUrl: DUMMY_FILES.SERTIFIKAT,
        },
      },
      ulasan: {
        create: {
          ulasan:
            'Sangat-sangat recommended! Ilmunya daging semua, mentornya jago-jago. Belajar banyak soal networking dan security.',
          rating: 5,
        },
      },
    },
  });
  await generateLogbookEntries(ajuanHadi.id, threeWeeksAgo, oneWeekAgo);

  console.log('Membuat Kriteria 8 (Data Ulasan 5/5)...');
  const user12 = await prisma.user.create({
    data: {
      email: 'peserta.selesai.5@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Indah Puas',
          tglLahir: new Date('2002-06-10T00:00:00Z'),
          noTelepon: '081299992222',
          nik: '1234123412341234',
          nimNis: '787878445566',
          instansi: 'Universitas Surabaya',
          jurusan: 'Desain Komunikasi Visual',
          alamat: 'Jl. Ngagel No. 9',
          instagram: 'indahpuas',
          pasFoto: DUMMY_FILES.PP_CEWEK,
          ktp: DUMMY_FILES.FOTO_KTP_REGIS,
          status: 'APPROVED',
          bidangId: bidangPikp.id,
        },
      },
    },
    include: { pesertaMagang: true },
  });
  const ajuanIndah = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Surabaya',
      jurusan: 'Desain Komunikasi Visual',
      tglMulai: threeWeeksAgo,
      tglSelesai: oneWeekAgo,
      temaMagang: 'Pembuatan Konten Infografis',
      statusUsulan: 'APPROVED',
      pesertaId: user12.pesertaMagang.id,
      bidangId: bidangPikp.id,
      berkas: { create: createDummyBerkas() },
      suratPenerimaan: {
        create: {
          noSurat: '129/SP/PIKP/2025',
          fileUrl: DUMMY_FILES.SURAT_PENERIMAAN,
          fileId: 'file129',
        },
      },
      laporan: {
        create: {
          fileLaporan: DUMMY_FILES.LAPORAN_AKHIR,
          status: 'APPROVED',
          catatan: 'Desainnya kreatif.',
        },
      },
      sertifikat: {
        create: {
          noSertifikat: 'SRT/2025/005',
          nilai: 92,
          fileUrl: DUMMY_FILES.SERTIFIKAT,
        },
      },
      ulasan: {
        create: {
          ulasan:
            'Seru banget! Dikasih kepercayaan buat handle desain beneran. Portofolio auto nambah. Terima kasih!',
          rating: 5,
        },
      },
    },
  });
  await generateLogbookEntries(ajuanIndah.id, threeWeeksAgo, oneWeekAgo);

  console.log('✅ Proses seeding selesai.');
}

// ====================================================================
// EKSEKUSI SCRIPT
// ====================================================================
main()
  .catch((e) => {
    console.error('❌ Terjadi error saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Selalu tutup koneksi prisma
    await prisma.$disconnect();
    console.log('🔌 Koneksi database ditutup.');
  });
