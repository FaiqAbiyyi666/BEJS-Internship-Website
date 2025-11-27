// 1. Impor fungsi yang akan diuji
const { register } = require('../controllers/auth.controller'); // Sesuaikan path ini

// 2. Mock semua dependensi eksternal
// Kita akan memalsukan prisma client, bcrypt, ejs, dan sendMail
const { PrismaClient, Role, StatusPeserta } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const path = require('path');
const sendMail = require('../utils/sendEmail'); // Sesuaikan path ini

// Memberitahu Jest untuk memalsukan semua modul ini
jest.mock('@prisma/client', () => {
  // Mock enum secara manual
  const Role = { peserta_magang: 'peserta_magang' };
  const StatusPeserta = { PENDING: 'PENDING' };

  // Mock Prisma Client
  const mPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    pesertaMagang: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mPrismaClient),
    Role: Role, // Ekspor mock enum
    StatusPeserta: StatusPeserta, // Ekspor mock enum
  };
});

jest.mock('bcryptjs');
jest.mock('ejs');
jest.mock('path');

// DIPERBAIKI (FINAL): Mock modul '../utils/sendEmail' sebagai satu fungsi
// Ini akan sesuai dengan impor di baris 7 (const sendMail = require(...))
jest.mock('../utils/sendEmail', () => jest.fn()); // Sesuaikan path ini

// Inisialisasi mock prisma instance untuk diakses di tes
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

describe('Auth Controller - Register (Sukses)', () => {
  it('should register a new user successfully and return 201', async () => {
    // ---- Arrange (Persiapan Data) ----
    mockReq.body = {
      namaLengkap: 'John Doe',
      tglLahir: '2000-01-01',
      email: 'john.doe@example.com',
      password: 'password123',
      noTelepon: '08123456789',
      nik: '1234567890123456',
      alamat: 'Jl. Merdeka 1',
      pasFotoUrl: 'http://foto.com/img.jpg',
      instagram: 'johndoe.ig',
      nimNis: '12345',
      instansi: 'Universitas ABC',
      jurusan: 'Informatika',
    };

    // Mock balikan dari database
    // 1. Email tidak ditemukan (findUnique mengembalikan null)
    prisma.user.findUnique.mockResolvedValue(null);

    // 2. Mock hasil hashing password
    bcrypt.hash.mockResolvedValue('hashedPassword');

    // 3. Mock hasil pembuatan user baru
    const mockNewUser = { id: 'user-123', email: mockReq.body.email };
    prisma.user.create.mockResolvedValue(mockNewUser);

    // 4. Mock hasil pembuatan peserta magang
    const mockNewPeserta = { id: 'peserta-123', ...mockReq.body };
    prisma.pesertaMagang.create.mockResolvedValue(mockNewPeserta);

    // 5. Mock render email
    ejs.renderFile.mockResolvedValue('<html>Email content</html>');

    // 6. Mock sendMail
    // Variabel 'sendMail' sekarang adalah mock function itu sendiri
    sendMail.mockResolvedValue(true);

    // ---- Act (Eksekusi Fungsi) ----
    await register(mockReq, mockRes, mockNext);

    // ---- Assert (Pengecekan Hasil) ----
    // Pastikan email dicek
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'john.doe@example.com' },
    });

    // Pastikan password di-hash
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);

    // Pastikan user dibuat dengan data yang benar
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: 'john.doe@example.com',
          password: 'hashedPassword',
          role: Role.peserta_magang,
        },
      })
    );

    // Pastikan peserta magang dibuat dengan data yang benar
    expect(prisma.pesertaMagang.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockNewUser.id,
          namaLengkap: 'John Doe',
          status: StatusPeserta.PENDING,
          pasFoto: 'http://foto.com/img.jpg',
        }),
      })
    );

    // Pastikan email terkirim
    expect(sendMail).toHaveBeenCalled();

    // Pastikan response sukses dikirim
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      status: true,
      message: 'Registrasi berhasil. Menunggu persetujuan admin.',
      data: mockNewPeserta,
    });
  });
});

describe('Auth Controller - Register (Gagal)', () => {
  it('should return 400 if required fields are missing', async () => {
    // Arrange: Hanya kirim email dan password
    mockReq.body = {
      email: 'test@example.com',
      password: '123',
    };

    // Act
    await register(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Semua field wajib diisi'),
      })
    );
    // Pastikan tidak ada interaksi ke DB
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should return 409 if email is already used', async () => {
    // Arrange: Kirim data lengkap
    mockReq.body = {
      namaLengkap: 'Jane Doe',
      tglLahir: '2000-01-01',
      email: 'jane.doe@example.com',
      password: 'password123',
      noTelepon: '08123456789',
      nik: '1234567890123456',
      alamat: 'Jl. Merdeka 1',
      pasFotoUrl: 'http://foto.com/img.jpg',
      instagram: 'janedoe.ig',
    };

    // Mock email DITEMUKAN
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      email: 'jane.doe@example.com',
    });

    // Act
    await register(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Email sudah digunakan',
      })
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should return 400 if tglLahir format is invalid', async () => {
    // Arrange
    mockReq.body = {
      namaLengkap: 'Test User',
      tglLahir: 'INI BUKAN TANGGAL', // Format salah
      email: 'test@example.com',
      password: 'password123',
      noTelepon: '08123456789',
      nik: '1234567890123456',
      alamat: 'Jl. Merdeka 1',
      pasFotoUrl: 'http://foto.com/img.jpg',
      instagram: 'test.ig',
    };

    // Act
    await register(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Format tanggal lahir tidak valid (gunakan YYYY-MM-DD)',
      })
    );
  });

  it('should return 500 if a server error occurs', async () => {
    // Arrange: Kirim data lengkap
    mockReq.body = {
      namaLengkap: 'Error User',
      tglLahir: '2000-01-01',
      email: 'error@example.com',
      password: 'password123',
      noTelepon: '08123456789',
      nik: '1234567890123456',
      alamat: 'Jl. Merdeka 1',
      pasFotoUrl: 'http://foto.com/img.jpg',
      instagram: 'error.ig',
    };

    // Simulasikan database error
    const dbError = new Error('Database connection error');
    prisma.user.findUnique.mockRejectedValue(dbError);

    // Act
    await register(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Terjadi kesalahan pada server',
        error: dbError.message,
      })
    );
  });
});
