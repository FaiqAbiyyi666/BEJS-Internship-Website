// 1. Impor fungsi yang akan diuji
const { login } = require('../controllers/auth.controller'); // Sesuaikan path

// 2. Mock semua dependensi eksternal
const { PrismaClient, StatusPeserta } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // Asumsi kamu menggunakan bcryptjs
const jwt = require('jsonwebtoken'); // Dependensi untuk login

// --- MOCK PRISMA ---
jest.mock('@prisma/client', () => {
  // Mock enum secara manual
  const StatusPeserta = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
  };

  // Mock Prisma Client
  const mPrismaClient = {
    user: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mPrismaClient),
    StatusPeserta: StatusPeserta, // Ekspor mock enum
  };
});

// --- MOCK MODUL LAIN ---
jest.mock('bcryptjs');
jest.mock('jsonwebtoken'); // Mock 'jsonwebtoken'

// Inisialisasi mock prisma instance
const prisma = new PrismaClient();

// 3. Siapkan mock object untuk req, res, next
let mockReq, mockRes, mockNext;

beforeEach(() => {
  // Reset semua mock sebelum setiap tes
  jest.clearAllMocks();

  // Buat mock response object
  mockRes = {
    status: jest.fn(() => mockRes), // Memungkinkan chaining .status().json()
    json: jest.fn(),
  };

  // Buat mock request object dasar
  mockReq = {
    body: {},
  };

  // Buat mock next function
  mockNext = jest.fn();
});

// ===============================================
//           TES UNTUK FUNGSI LOGIN
// ===============================================
describe('Auth Controller - Login (Sukses)', () => {
  it('should login an admin successfully and return 200 with a token', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'admin@example.com', password: 'password123' };

    const mockUser = {
      id: 'admin-id-123',
      email: 'admin@example.com',
      password: 'hashedPassword',
      role: 'admin',
      pesertaMagang: null, // Sesuai logika controller
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true); // Password benar
    jwt.sign.mockReturnValue('fake-jwt-token-admin'); // Buat token palsu

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(prisma.user.findUnique).toHaveBeenCalled();
    expect(bcrypt.compare).toHaveBeenCalled();
    expect(jwt.sign).toHaveBeenCalled(); // Pastikan token dibuat
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: true,
        message: 'Login berhasil',
      })
    );
  });

  it('should login an approved "peserta_magang" successfully and return 200', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'peserta@example.com', password: 'password123' };

    const mockUser = {
      id: 'peserta-id-456',
      email: 'peserta@example.com',
      password: 'hashedPassword',
      role: 'peserta_magang',
      pesertaMagang: {
        status: StatusPeserta.APPROVED, // Sesuai logika controller
        namaLengkap: 'Budi Peserta',
        pasFoto: 'foto.jpg',
      },
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('fake-jwt-token-peserta');

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: expect.objectContaining({ namaLengkap: 'Budi Peserta' }),
        }),
      })
    );
  });
});

describe('Auth Controller - Login (Gagal)', () => {
  it('should return 400 if email or password are missing', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'test@example.com' }; // Password tidak ada

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    // Sesuai dengan: if (!email || !password)
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Email dan password wajib diisi' })
    );
  });

  it('should return 401 if email is not found', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'tidakada@example.com', password: '123' };
    prisma.user.findUnique.mockResolvedValue(null); // User tidak ditemukan

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    // Sesuai dengan: if (!user)
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Email tidak terdaftar' })
    );
  });

  it('should return 401 if password is wrong', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'admin@example.com', password: 'passwordSALAH' };
    const mockUser = {
      id: 'admin-id-123',
      email: 'admin@example.com',
      password: 'hashedPassword',
      role: 'admin',
    };
    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false); // Password salah

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    // Sesuai dengan: if (!validPassword)
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Password salah' })
    );
  });

  it('should return 403 if "peserta_magang" status is PENDING', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'pending@example.com', password: 'password123' };
    const mockUser = {
      id: 'peserta-id-789',
      email: 'pending@example.com',
      password: 'hashedPassword',
      role: 'peserta_magang',
      pesertaMagang: {
        status: StatusPeserta.PENDING, // Status PENDING
      },
    };
    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true); // Password benar

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    // Sesuai dengan: else if (user.pesertaMagang?.status === StatusPeserta.PENDING)
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Akun Kamu sedang ditinjau (Pending)'),
      })
    );
  });

  it('should return 403 if "peserta_magang" status is REJECTED', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'rejected@example.com', password: 'password123' };
    const mockUser = {
      id: 'peserta-id-101',
      email: 'rejected@example.com',
      password: 'hashedPassword',
      role: 'peserta_magang',
      pesertaMagang: {
        status: StatusPeserta.REJECTED, // Status REJECTED
      },
    };
    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true); // Password benar

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    // Sesuai dengan: if (user.pesertaMagang?.status === StatusPeserta.REJECTED)
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Pengajuan akun kamu telah ditolak'),
      })
    );
  });

  it('should call next(error) if a server error occurs', async () => {
    // ---- Arrange ----
    mockReq.body = { email: 'error@example.com', password: '123' };
    const dbError = new Error('Database connection error');
    prisma.user.findUnique.mockRejectedValue(dbError); // Simulasikan DB error

    // ---- Act ----
    await login(mockReq, mockRes, mockNext);

    // ---- Assert ----
    // Sesuai dengan: catch (error) { next(error); }
    expect(mockNext).toHaveBeenCalledWith(dbError);
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
