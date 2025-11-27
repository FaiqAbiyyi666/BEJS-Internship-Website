// 1. Impor fungsi controller
const { createAjuanMagang } = require('../controllers/ajuanMagang.controller');

// 2. SETUP MOCKING
jest.mock('../utils/database', () => {
  // Membuat object mock prisma
  const mPrismaClient = {
    pesertaMagang: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    kuotaBidang: {
      findUnique: jest.fn(),
    },
    ajuanMagang: {
      count: jest.fn(),
      create: jest.fn(),
    },
    berkasMagang: {
      create: jest.fn(),
    },
    // PENTING: Mock transaction agar langsung mengeksekusi fungsi di dalamnya
    // Kita passing 'mPrismaClient' agar saat controller memanggil tx.update, dia pakai mock ini juga
    $transaction: jest.fn(async (callback) => await callback(mPrismaClient)),
  };

  // Kembalikan object yang memiliki property 'prisma'
  return {
    prisma: mPrismaClient,
  };
});

// 3. IMPOR PRISMA (YANG SUDAH DI-MOCK)
// Baris ini akan mengambil hasil dari jest.mock di atas, bukan file asli.
const { prisma } = require('../utils/database');

// 4. Setup Mock Request, Response, Next
let mockReq, mockRes, mockNext;

beforeEach(() => {
  jest.clearAllMocks(); // Bersihkan rekaman panggilan sebelum setiap test

  mockRes = {
    status: jest.fn(() => mockRes), // Agar bisa chaining res.status().json()
    json: jest.fn(),
  };

  mockReq = {
    body: {},
    user: {},
  };

  mockNext = jest.fn();
});

describe('US-07: Create Ajuan Magang', () => {
  // Data dummy untuk testing
  const validBody = {
    namaLengkap: 'Budi Santoso',
    nis_nim: '12345678',
    instansi: 'Universitas Brawijaya',
    jurusan: 'Teknik Informatika',
    bidangPilihan: 'uuid-bidang-tik',
    durasiMulai: '2024-01-01',
    durasiSelesai: '2024-03-01',
    kategori: 'Mahasiswa',
    tema: 'Web Dev',
    statusPendidikan: 'Aktif',
    jenjangPendidikan: 'S1',
    berkas_urls: {
      surat_pengantar: 'http://url.com/surat.pdf',
      proposal_magang: 'http://url.com/proposal.pdf',
      cv: 'http://url.com/cv.pdf',
      ktp: 'http://url.com/ktp.jpg',
      surat_bakesbang_sda: 'http://url.com/bangkesbang.pdf',
    },
  };

  const validUser = { id: 'user-uuid-123' };

  // --- POSITIVE CASE ---
  it('TC-US07-001: Seharusnya BERHASIL mendaftar jika data lengkap dan kuota tersedia', async () => {
    mockReq.body = validBody;
    mockReq.user = validUser;

    // Mocking urutan pemanggilan database:

    // 1. Cek Peserta (User ditemukan, tidak ada ajuan pending)
    prisma.pesertaMagang.findUnique.mockResolvedValue({
      id: 'peserta-id-1',
      ajuan: [],
    });

    // 2. Update Profil (Di dalam transaction)
    prisma.pesertaMagang.update.mockResolvedValue({});

    // 3. Cek Kuota (Di dalam transaction)
    prisma.kuotaBidang.findUnique.mockResolvedValue({ kuota: 5 });
    prisma.ajuanMagang.count.mockResolvedValue(2); // Terisi 2, sisa 3 (AMAN)

    // 4. Create Ajuan & Berkas (Di dalam transaction)
    const mockCreatedAjuan = { id: 'new-ajuan-id', statusUsulan: 'PENDING' };
    prisma.ajuanMagang.create.mockResolvedValue(mockCreatedAjuan);
    prisma.berkasMagang.create.mockResolvedValue({});

    // Eksekusi Controller
    await createAjuanMagang(mockReq, mockRes, mockNext);

    // Assertions (Pengecekan)
    expect(prisma.$transaction).toHaveBeenCalled(); // Pastikan transaksi jalan
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: true,
        data: mockCreatedAjuan,
      })
    );
  });

  // --- NEGATIVE CASES ---

  it('TC-US07-002: Gagal jika Autentikasi Tidak Valid', async () => {
    mockReq.body = validBody;
    mockReq.user = null; // User tidak ada

    await createAjuanMagang(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('TC-US07-004: Gagal jika Peserta Memiliki Ajuan PENDING', async () => {
    mockReq.body = validBody;
    mockReq.user = validUser;

    // Mock user punya 1 ajuan PENDING
    prisma.pesertaMagang.findUnique.mockResolvedValue({
      id: 'peserta-id-1',
      ajuan: [{ statusUsulan: 'PENDING' }],
    });

    await createAjuanMagang(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Anda sudah memiliki ajuan magang yang sedang diproses'
        ),
      })
    );
  });

  it('TC-US07-006: Gagal jika Kuota Bidang Penuh', async () => {
    mockReq.body = validBody;
    mockReq.user = validUser;

    prisma.pesertaMagang.findUnique.mockResolvedValue({
      id: 'peserta-id-1',
      ajuan: [],
    });

    // Mock Kuota Penuh
    prisma.kuotaBidang.findUnique.mockResolvedValue({ kuota: 5 });
    prisma.ajuanMagang.count.mockResolvedValue(5); // Terisi 5 (PENUH)

    await createAjuanMagang(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Kuota untuk bidang ini sudah penuh.',
      })
    );
  });
});
