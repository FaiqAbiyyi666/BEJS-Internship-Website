const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Helper untuk hash password
async function hashPassword(password) {
  // Anda bisa mengganti 10 dengan angka lain jika mau (salt rounds)
  return bcrypt.hash(password, 10);
}

// Helper untuk tanggal
function getDates() {
  const today = new Date();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const lastMonth = new Date(today);
  lastMonth.setMonth(today.getMonth() - 1);

  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setMonth(today.getMonth() - 2);

  const nextMonth = new Date(today);
  nextMonth.setMonth(today.getMonth() + 1);

  return { today, yesterday, lastMonth, twoMonthsAgo, nextMonth };
}

// Fungsi dummy data untuk berkas (agar tidak berulang)
function createDummyBerkas() {
  return {
    suratPengantar: 'path/to/surat_pengantar.pdf',
    proposalMagang: 'path/to/proposal_magang.pdf',
    cv: 'path/to/cv.pdf',
    ktp: 'path/to/ktp.pdf',
    suratBakesbangpolSda: 'path/to/bakesbangpol_sda.pdf',
  };
}

async function main() {
  console.log('🌱 Memulai proses seeding...');
  const { today, yesterday, lastMonth, twoMonthsAgo, nextMonth } = getDates();
  // Password default untuk semua akun dummy
  const defaultPassword = await hashPassword('password123');

  // ====================================================================
  // 1. 🧹 HAPUS DATA LAMA (Urutan penting!)
  // ====================================================================
  console.log('Membersihkan data lama...');
  // Hapus model yang bergantung pada AjuanMagang
  await prisma.logbook.deleteMany();
  await prisma.laporanHasilMagang.deleteMany();
  await prisma.sertifikat.deleteMany();
  await prisma.ulasanMagang.deleteMany();
  await prisma.suratPenerimaan.deleteMany();
  await prisma.berkasMagang.deleteMany();

  // Hapus model yang bergantung pada User
  await prisma.notifikasi.deleteMany();
  await prisma.kritikSaran.deleteMany();

  // Hapus model yang bergantung pada PesertaMagang & KuotaBidang
  await prisma.ajuanMagang.deleteMany();

  // Hapus model yang bergantung pada User & KuotaBidang
  await prisma.pesertaMagang.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.subKoordinatorBidang.deleteMany();

  // Hapus model dasar
  await prisma.user.deleteMany();
  await prisma.kuotaBidang.deleteMany();
  await prisma.statistikPengunjung.deleteMany(); // Jika ada

  // ====================================================================
  // 2. 🏢 BUAT DATA PRASYARAT (KUOTA BIDANG)
  // ====================================================================
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

  // ====================================================================
  // 3. 🧑‍💼 BUAT DATA ADMIN & SUBKOORDINATOR
  // ====================================================================
  console.log('Membuat Admin & Subkoordinator...');
  // Admin Utama
  await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: defaultPassword,
      role: 'admin',
      admin: {
        create: {
          nama: 'Admin Utama',
          bidangId: bidangTatakelola.id, // Admin ini mengawasi Tata Kelola
        },
      },
    },
  });

  // Subkoordinator Bidang PIKP
  await prisma.user.create({
    data: {
      email: 'subkoor.pikp@test.com',
      password: defaultPassword,
      role: 'sub_koordinator_bidang',
      subKoordinatorBidang: {
        create: {
          nama: 'Subkoor PIKP',
          bidangId: bidangPikp.id, // Subkoor ini penanggung jawab PIKP
        },
      },
    },
  });

  // ====================================================================
  // 4. 👤 BUAT DATA DUMMY PESERTA MAGANG
  // ====================================================================

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
          nimNis: '112233',
          instansi: 'Universitas Pending',
          jurusan: 'Teknik Informatika',
          alamat: 'Jl. Merdeka No. 1',
          instagram: 'budipending',
          pasFoto: 'path/to/foto_budi.jpg',
          status: 'PENDING',
          // bidangId sengaja null karena belum diapprove
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
          nimNis: '445566',
          instansi: 'Universitas Setuju',
          jurusan: 'Ilmu Komunikasi',
          alamat: 'Jl. Damai No. 2',
          instagram: 'aniapproved',
          pasFoto: 'path/to/foto_ani.jpg',
          status: 'APPROVED',
          bidangId: bidangPikp.id, // Sudah di-assign ke bidang PIKP
        },
      },
    },
  });

  // --- Kriteria 3: Ajuan diterima, belum isi logbook ---
  console.log('Membuat Kriteria 3 (Ajuan Diterima, No Logbook)...');
  const user3 = await prisma.user.create({
    data: {
      email: 'peserta.no.logbook@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Candra Logbook',
          tglLahir: new Date('2003-01-15T00:00:00Z'),
          noTelepon: '081233334444',
          nik: '1122334455667788',
          nimNis: '778899',
          instansi: 'Politeknik Negeri',
          jurusan: 'Manajemen Informatika',
          alamat: 'Jl. Sejahtera No. 3',
          instagram: 'candralog',
          pasFoto: 'path/to/foto_candra.jpg',
          status: 'APPROVED',
          bidangId: bidangTatakelola.id,
        },
      },
    },
    // ---- PERBAIKAN: Include data pesertaMagang yg baru dibuat ----
    include: {
      pesertaMagang: true,
    },
    // -------------------------------------------------------------
  });

  // Buat Ajuan Magang untuk Candra
  await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'D3',
      instansi: 'Politeknik Negeri',
      jurusan: 'Manajemen Informatika',
      tglMulai: today, // Magang dimulai hari ini
      tglSelesai: nextMonth, // Selesai bulan depan
      temaMagang: 'Pengembangan Sistem Internal',
      statusUsulan: 'APPROVED', // Ajuan diterima
      pesertaId: user3.pesertaMagang.id, // <-- Ini sekarang aman
      bidangId: bidangTatakelola.id,
      // Buat data relasi (Berkas & Surat)
      berkas: {
        create: createDummyBerkas(),
      },
      suratPenerimaan: {
        create: {
          noSurat: '123/SP/TI/2025',
          fileUrl: 'path/to/surat_penerimaan_candra.pdf',
          fileId: 'file123',
        },
      },
      // Tidak ada Logbook yang dibuat
    },
  });

  // --- Kriteria 4: Magang hampir selesai, belum kirim laporan ---
  console.log('Membuat Kriteria 4 (Hampir Selesai, No Laporan)...');
  const user4 = await prisma.user.create({
    data: {
      email: 'peserta.no.laporan@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Dina Laporan',
          tglLahir: new Date('2000-08-30T00:00:00Z'),
          noTelepon: '081255556666',
          nik: '9988776655443322',
          nimNis: '101010',
          instansi: 'Universitas Veteran',
          jurusan: 'Sistem Informasi',
          alamat: 'Jl. Pahlawan No. 4',
          instagram: 'dinalap',
          pasFoto: 'path/to/foto_dina.jpg',
          status: 'APPROVED',
          bidangId: bidangInfra.id,
        },
      },
    },
    // ---- PERBAIKAN: Include data pesertaMagang yg baru dibuat ----
    include: {
      pesertaMagang: true,
    },
    // -------------------------------------------------------------
  });

  // Buat Ajuan Magang untuk Dina
  const ajuanDina = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Universitas Veteran',
      jurusan: 'Sistem Informasi',
      tglMulai: twoMonthsAgo, // Mulai 2 bulan lalu
      tglSelesai: yesterday, // Selesai kemarin
      temaMagang: 'Analisis Keamanan Jaringan',
      statusUsulan: 'APPROVED',
      pesertaId: user4.pesertaMagang.id, // <-- Ini sekarang aman
      bidangId: bidangInfra.id,
      berkas: {
        create: createDummyBerkas(),
      },
      suratPenerimaan: {
        create: {
          noSurat: '124/SP/INFRA/2025',
          fileUrl: 'path/to/surat_penerimaan_dina.pdf',
          fileId: 'file124',
        },
      },
    },
  });
  // Buat beberapa Logbook untuk Dina
  await prisma.logbook.createMany({
    data: [
      {
        ajuanId: ajuanDina.id,
        tanggal: twoMonthsAgo, // Tanggal logbook
        deskripsi: 'Melakukan analisis kebutuhan sistem keamanan.',
      },
      {
        ajuanId: ajuanDina.id,
        tanggal: lastMonth, // Tanggal logbook
        deskripsi: 'Mulai implementasi firewall.',
      },
      {
        ajuanId: ajuanDina.id,
        tanggal: yesterday, // Tanggal logbook
        deskripsi: 'Menyelesaikan testing penetrasi.',
      },
    ],
  });
  // Tidak ada LaporanHasilMagang yang dibuat

  // --- Kriteria 5: Magang Selesai, Laporan Approved, Ada Ulasan ---
  console.log('Membuat Kriteria 5 (Siklus Selesai, Ada Ulasan)...');
  const user5 = await prisma.user.create({
    data: {
      email: 'peserta.selesai@test.com',
      password: defaultPassword,
      role: 'peserta_magang',
      pesertaMagang: {
        create: {
          namaLengkap: 'Eka Selesai',
          tglLahir: new Date('2001-04-25T00:00:00Z'),
          noTelepon: '081277778888',
          nik: '5566778899001122',
          nimNis: '987654',
          instansi: 'Institut Teknologi',
          jurusan: 'Ilmu Komputer',
          alamat: 'Jl. Juang No. 5',
          instagram: 'ekaselesai',
          pasFoto: 'path/to/foto_eka.jpg',
          status: 'APPROVED',
          bidangId: bidangStat.id, // Bidang Statistik
        },
      },
    },
    // ---- PERBAIKAN: Include data pesertaMagang yg baru dibuat ----
    include: {
      pesertaMagang: true,
    },
    // -------------------------------------------------------------
  });

  // Buat Ajuan Magang LENGKAP untuk Eka
  const ajuanEka = await prisma.ajuanMagang.create({
    data: {
      kategoriMagang: 'Mahasiswa',
      statusPendidikan: 'Aktif',
      jenjangPendidikan: 'S1',
      instansi: 'Institut Teknologi',
      jurusan: 'Ilmu Komputer',
      tglMulai: twoMonthsAgo, // Mulai 2 bulan lalu
      tglSelesai: lastMonth, // Selesai 1 bulan lalu
      temaMagang: 'Analisis Data Statistik Kependudukan',
      statusUsulan: 'APPROVED',
      pesertaId: user5.pesertaMagang.id, // <-- Ini sekarang aman
      bidangId: bidangStat.id,
      // Semua relasi dibuat
      berkas: {
        create: createDummyBerkas(),
      },
      suratPenerimaan: {
        create: {
          noSurat: '125/SP/STAT/2025',
          fileUrl: 'path/to/surat_penerimaan_eka.pdf',
          fileId: 'file125',
        },
      },
      laporan: {
        create: {
          fileLaporan: 'path/to/laporan_eka_final.pdf',
          status: 'APPROVED', // Laporan sudah di-approve
          catatan: 'Laporan sangat baik dan komprehensif.',
        },
      },
      sertifikat: {
        create: {
          noSertifikat: 'SRT/2025/001',
          nilai: 95, // Mendapat nilai A
          fileUrl: 'path/to/sertifikat_eka.pdf',
        },
      },
      ulasan: {
        create: {
          ulasan:
            'Pengalaman magang yang luar biasa! Pembimbing sangat membantu dan materi yang didapat sangat relevan dengan perkuliahan. Sangat direkomendasikan.',
          rating: 5, // Bintang 5
        },
      },
    },
  });
  // Buat Logbook untuk Eka
  await prisma.logbook.createMany({
    data: [
      {
        ajuanId: ajuanEka.id,
        tanggal: twoMonthsAgo,
        deskripsi: 'Briefing awal dan pengenalan lingkungan kerja.',
      },
      {
        ajuanId: ajuanEka.id,
        tanggal: lastMonth,
        deskripsi: 'Menyerahkan draf laporan akhir untuk direview.',
      },
    ],
  });

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
