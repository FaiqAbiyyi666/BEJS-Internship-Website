const { updateStatusAjuan } = require('../controllers/ajuanMagang.controller');

// --- 1. MOCKING DEPENDENCIES ---

// Mock Database (Prisma)
jest.mock('../utils/database', () => {
  const mPrismaClient = {
    ajuanMagang: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    pesertaMagang: {
      update: jest.fn(),
    },
    kuotaBidang: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => await callback(mPrismaClient)),
  };
  return { prisma: mPrismaClient };
});

// Mock EJS (Template Engine) agar tidak error mencari file view
jest.mock('ejs', () => ({
  renderFile: jest.fn((path, data, cb) => cb(null, '<html>Mock Email</html>')),
}));

// Mock SendEmail Utility
jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue(true));

// --- 2. IMPORTS SETELAH MOCKING ---
const { prisma } = require('../utils/database');
const ejs = require('ejs');
const sendEmail = require('../utils/sendEmail');

// --- 3. SETUP TEST VARIABLES ---
let mockReq, mockRes, mockNext;

beforeEach(() => {
  jest.clearAllMocks();

  mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  mockReq = {
    params: {},
    body: {},
  };

  mockNext = jest.fn();
});

describe('US-18: Verifikasi Ajuan Magang (Update Status)', () => {
  // Data Dummy untuk Ajuan yang ada di DB
  const mockAjuanData = {
    id: 'ajuan-123',
    statusUsulan: 'PENDING',
    tglMulai: new Date(),
    tglSelesai: new Date(),
    peserta: {
      id: 'peserta-123',
      namaLengkap: 'Budi Santoso',
      user: { email: 'budi@example.com' },
    },
    bidang: { id: 'bidang-tik', nama: 'TIK' },
  };

  // ==================================================
  // POSITIVE CASES (Skenario Sukses)
  // ==================================================

  it('TC-US18-001: Admin dapat MENERIMA ajuan jika kuota tersedia', async () => {
    // Arrange (Persiapan)
    mockReq.params.id = 'ajuan-123';
    mockReq.body.status = 'DITERIMA';

    // 1. Mock Data Ajuan Ditemukan
    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanData);

    // 2. Mock Cek Kuota (Kuota 5, Terisi 2 -> Masih Aman)
    // Perhatikan: Kita mock findUnique (untuk kapasitas) dan count (untuk yang terisi)
    prisma.kuotaBidang.findUnique.mockResolvedValue({
      id: 'bidang-tik',
      kuota: 5,
    });
    prisma.ajuanMagang.count.mockResolvedValue(2);

    // 3. Mock Update Berhasil
    prisma.ajuanMagang.update.mockResolvedValue({});
    prisma.pesertaMagang.update.mockResolvedValue({});

    // Act (Eksekusi)
    await updateStatusAjuan(mockReq, mockRes, mockNext);

    // Assert (Verifikasi)
    // Pastikan transaksi dijalankan
    expect(prisma.$transaction).toHaveBeenCalled();

    // Pastikan update status ajuan menjadi APPROVED
    expect(prisma.ajuanMagang.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ajuan-123' },
        data: { statusUsulan: 'APPROVED' },
      })
    );

    // Pastikan email notifikasi dikirim
    expect(ejs.renderFile).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();

    // Pastikan response 200 OK
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: true,
        message: expect.stringContaining('Ajuan berhasil di-diterima'),
      })
    );
  });

  it('TC-US18-002: Admin dapat MENOLAK ajuan (Tanpa cek kuota)', async () => {
    // Arrange
    mockReq.params.id = 'ajuan-123';
    mockReq.body.status = 'DITOLAK';

    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanData);

    // Act
    await updateStatusAjuan(mockReq, mockRes, mockNext);

    // Assert
    expect(prisma.$transaction).toHaveBeenCalled();

    // Pastikan status diupdate menjadi REJECTED
    expect(prisma.ajuanMagang.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { statusUsulan: 'REJECTED' },
      })
    );

    // Pastikan Cek Kuota TIDAK dipanggil (karena ditolak)
    expect(prisma.kuotaBidang.findUnique).not.toHaveBeenCalled();

    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  // ==================================================
  // NEGATIVE CASES (Skenario Gagal / Validasi)
  // ==================================================

  it('TC-US18-003: Gagal jika Status yang dikirim tidak valid', async () => {
    // Arrange: Kirim status typo/salah
    mockReq.params.id = 'ajuan-123';
    mockReq.body.status = 'DIPENDING'; // Harusnya DITERIMA/DITOLAK

    // Act
    await updateStatusAjuan(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Status harus 'DITERIMA' atau 'DITOLAK'.",
      })
    );

    // Database tidak boleh diakses
    expect(prisma.ajuanMagang.findUnique).not.toHaveBeenCalled();
  });

  it('TC-US18-004: Gagal jika Data Ajuan Tidak Ditemukan', async () => {
    // Arrange
    mockReq.params.id = 'id-gaib';
    mockReq.body.status = 'DITOLAK';

    // Mock database return null
    prisma.ajuanMagang.findUnique.mockResolvedValue(null);

    // Act
    await updateStatusAjuan(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ajuan Magang tidak ditemukan.',
      })
    );
  });

  it('TC-US18-005: Gagal Menerima jika Kuota Bidang Sudah Penuh', async () => {
    // Arrange
    mockReq.params.id = 'ajuan-123';
    mockReq.body.status = 'DITERIMA';

    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanData);

    // Mock Kuota PENUH (Kapasitas 5, Terisi 5)
    prisma.kuotaBidang.findUnique.mockResolvedValue({
      id: 'bidang-tik',
      kuota: 5,
    });
    prisma.ajuanMagang.count.mockResolvedValue(5);

    // Act
    await updateStatusAjuan(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gagal menerima. Kuota untuk bidang ini sudah penuh.',
      })
    );

    // Pastikan transaksi update TIDAK dijalankan
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('TC-US18-006: Gagal (Error 500) jika Database Error', async () => {
    // Arrange
    mockReq.params.id = 'ajuan-123';
    mockReq.body.status = 'DITERIMA';

    // Simulasikan error koneksi saat cari data
    const dbError = new Error('DB Connection Failed');
    prisma.ajuanMagang.findUnique.mockRejectedValue(dbError);

    // Act
    await updateStatusAjuan(mockReq, mockRes, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalledWith(dbError);
  });
});
