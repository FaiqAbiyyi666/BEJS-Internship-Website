// 1. Impor fungsi yang akan diuji
const {
  approvePesertaMagang,
  rejectPesertaMagang,
} = require('../controllers/admin.controller'); // Sesuaikan path

// 2. Mock semua dependensi eksternal
const { PrismaClient } = require('@prisma/client');
const ejs = require('ejs');
const path = require('path');
const sendMail = require('../utils/sendEmail'); // Asumsi path ini

// --- MOCK PRISMA ---
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    pesertaMagang: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notifikasi: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mPrismaClient),
  };
});

// --- MOCK MODUL LAIN ---
jest.mock('ejs');
jest.mock('path');
// Mock sendMail sebagai fungsi (default export)
jest.mock('../utils/sendEmail', () => jest.fn());

// Inisialisasi mock prisma instance
const prisma = new PrismaClient();

// 3. Siapkan mock object untuk req, res, next
let mockReq, mockRes, mockNext;

beforeEach(() => {
  jest.clearAllMocks();
  mockRes = {
    status: jest.fn(() => mockRes),
    json: jest.fn(),
  };
  mockReq = {
    params: {}, // Verifikasi menggunakan req.params.id
    body: {},
  };
  mockNext = jest.fn();
});

// ===============================================
//         TES UNTUK FUNGSI APPROVE
// ===============================================
describe('Admin Controller - approvePesertaMagang', () => {
  // --- TES SUKSES APPROVE ---
  it('should approve a PENDING participant and return 200', async () => {
    // ---- Arrange ----
    mockReq.params.id = 'peserta-pending-id';

    const mockPeserta = {
      id: 'peserta-pending-id',
      userId: 'user-id-123',
      namaLengkap: 'Budi Pending',
      status: 'PENDING', // Status awal harus PENDING
      user: { email: 'budi.pending@example.com' },
    };

    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.pesertaMagang.update.mockResolvedValue({}); // Sukses update
    prisma.notifikasi.create.mockResolvedValue({}); // Sukses notif
    ejs.renderFile.mockResolvedValue('<html>Email Approve</html>');
    sendMail.mockResolvedValue(true);

    // ---- Act ----
    await approvePesertaMagang(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(prisma.pesertaMagang.findUnique).toHaveBeenCalledWith({
      where: { id: 'peserta-pending-id' },
      include: { user: true },
    });
    // Pastikan update statusnya menjadi 'APPROVED'
    expect(prisma.pesertaMagang.update).toHaveBeenCalledWith({
      where: { id: 'peserta-pending-id' },
      data: { status: 'APPROVED' },
    });
    expect(prisma.notifikasi.create).toHaveBeenCalled(); // Notif dibuat
    expect(sendMail).toHaveBeenCalled(); // Email terkirim
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('berhasil disetujui'),
      })
    );
  });

  // --- TES GAGAL APPROVE ---
  it('should return 404 if participant is not found', async () => {
    // ---- Arrange ----
    mockReq.params.id = 'id-tidak-ada';
    prisma.pesertaMagang.findUnique.mockResolvedValue(null); // Tidak ditemukan

    // ---- Act ----
    await approvePesertaMagang(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Peserta magang tidak ditemukan' })
    );
  });

  it('should return 400 if participant status is not PENDING (e.g., already APPROVED)', async () => {
    // ---- Arrange ----
    mockReq.params.id = 'peserta-approved-id';
    const mockPeserta = {
      id: 'peserta-approved-id',
      status: 'APPROVED', // Status sudah APPROVED
    };
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);

    // ---- Act ----
    await approvePesertaMagang(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Peserta sudah dalam status APPROVED, tidak dapat diubah.',
      })
    );
    expect(prisma.pesertaMagang.update).not.toHaveBeenCalled(); // Tidak boleh update
  });
});

// ===============================================
//          TES UNTUK FUNGSI REJECT
// ===============================================
describe('Admin Controller - rejectPesertaMagang', () => {
  // --- TES SUKSES REJECT ---
  it('should reject a PENDING participant and return 200', async () => {
    // ---- Arrange ----
    mockReq.params.id = 'peserta-pending-id';

    const mockPeserta = {
      id: 'peserta-pending-id',
      userId: 'user-id-123',
      namaLengkap: 'Budi Pending',
      status: 'PENDING', // Status awal harus PENDING
      user: { email: 'budi.pending@example.com' },
    };

    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.pesertaMagang.update.mockResolvedValue({}); // Sukses update
    prisma.notifikasi.create.mockResolvedValue({}); // Sukses notif
    ejs.renderFile.mockResolvedValue('<html>Email Reject</html>');
    sendMail.mockResolvedValue(true);

    // ---- Act ----
    await rejectPesertaMagang(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(prisma.pesertaMagang.findUnique).toHaveBeenCalledWith({
      where: { id: 'peserta-pending-id' },
      include: { user: true },
    });
    // Pastikan update statusnya menjadi 'REJECTED'
    expect(prisma.pesertaMagang.update).toHaveBeenCalledWith({
      where: { id: 'peserta-pending-id' },
      data: { status: 'REJECTED' },
    });
    expect(sendMail).toHaveBeenCalled(); // Email terkirim
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('berhasil ditolak'),
      })
    );
  });

  // --- TES GAGAL REJECT ---
  it('should return 404 if participant is not found', async () => {
    // ---- Arrange ----
    mockReq.params.id = 'id-tidak-ada';
    prisma.pesertaMagang.findUnique.mockResolvedValue(null); // Tidak ditemukan

    // ---- Act ----
    await rejectPesertaMagang(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('should return 400 if participant status is not PENDING (e.g., already REJECTED)', async () => {
    // ---- Arrange ----
    mockReq.params.id = 'peserta-rejected-id';
    const mockPeserta = {
      id: 'peserta-rejected-id',
      status: 'REJECTED', // Status sudah REJECTED
    };
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);

    // ---- Act ----
    await rejectPesertaMagang(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Peserta sudah dalam status REJECTED, tidak dapat diubah.',
      })
    );
  });

  it('should call next(error) if database fails', async () => {
    // ---- Arrange ----
    mockReq.params.id = 'peserta-pending-id';
    const mockPeserta = {
      id: 'peserta-pending-id',
      status: 'PENDING',
    };
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);

    const dbError = new Error('Database connection error');
    prisma.pesertaMagang.update.mockRejectedValue(dbError); // Simulasikan DB error

    // ---- Act ----
    await approvePesertaMagang(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(mockNext).toHaveBeenCalledWith(dbError);
  });
});
