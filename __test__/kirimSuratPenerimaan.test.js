const {
  kirimSuratPenerimaan,
} = require('../controllers/ajuanMagang.controller');

jest.mock('../utils/database', () => {
  const mPrismaClient = {
    ajuanMagang: {
      findUnique: jest.fn(),
    },
    suratPenerimaan: {
      create: jest.fn(),
    },
  };
  return { prisma: mPrismaClient };
});

// Mock Library Eksternal
jest.mock('ejs', () => ({
  renderFile: jest.fn().mockResolvedValue('<html>Mock Template HTML</html>'),
}));

jest.mock('../utils/sendEmail', () => jest.fn().mockResolvedValue(true));

jest.mock('path', () => ({
  join: jest.fn(),
}));

// 3. SETUP VARIABLE
const { prisma } = require('../utils/database');
const ejs = require('ejs');
const sendEmail = require('../utils/sendEmail');

let mockReq, mockRes, mockNext;

beforeEach(() => {
  jest.clearAllMocks();

  mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  mockReq = {
    body: {},
    file: {}, // Mock file object dari Multer
  };

  mockNext = jest.fn();
});

describe('US-15: Kirim Surat Penerimaan Magang', () => {
  // Data Dummy Valid
  const validBody = {
    ajuanId: 'ajuan-123',
    noSurat: '001/DISKOMINFO/2024',
    fileUrl: 'http://imagekit.io/file.pdf',
    fileId: 'file-id-123',
  };

  const validFile = {
    buffer: Buffer.from('dummy-pdf-content'), // Mock PDF Buffer
  };

  const mockAjuanApproved = {
    id: 'ajuan-123',
    statusUsulan: 'APPROVED', // PENTING
    tglMulai: new Date(),
    tglSelesai: new Date(),
    suratPenerimaan: null, // Belum ada surat (Aman)
    peserta: {
      namaLengkap: 'Budi Santoso',
      user: { email: 'budi@example.com' },
    },
    bidang: { nama: 'TIK' },
  };

  // ==========================================
  // POSITIVE CASE (Skenario Sukses)
  // ==========================================

  it('TC-US15-001: Seharusnya BERHASIL mengirim surat jika status APPROVED dan data lengkap', async () => {
    // Arrange
    mockReq.body = validBody;
    mockReq.file = validFile;

    // Mock Database
    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanApproved);
    prisma.suratPenerimaan.create.mockResolvedValue({});

    // Act
    await kirimSuratPenerimaan(mockReq, mockRes, mockNext);

    // Assert
    // 1. Pastikan data disimpan ke DB
    expect(prisma.suratPenerimaan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          noSurat: validBody.noSurat,
          ajuanId: validBody.ajuanId,
        }),
      })
    );

    // 2. Pastikan Email Terkirim
    expect(ejs.renderFile).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'budi@example.com',
        subject: expect.stringContaining('Selamat! Anda Diterima'),
        attachments: expect.arrayContaining([
          expect.objectContaining({ contentType: 'application/pdf' }),
        ]),
      })
    );

    // 3. Response 201
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Surat penerimaan berhasil diunggah'),
      })
    );
  });

  // ==========================================
  // NEGATIVE CASES (Validasi & Logika Bisnis)
  // ==========================================

  it('TC-US15-002: Gagal jika Data Input Tidak Lengkap (Misal File Buffer Kosong)', async () => {
    // Arrange: Body lengkap, tapi File tidak ada
    mockReq.body = validBody;
    mockReq.file = undefined;

    // Act
    await kirimSuratPenerimaan(mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Data tidak lengkap'),
      })
    );
    expect(prisma.suratPenerimaan.create).not.toHaveBeenCalled();
  });

  it('TC-US15-003: Gagal jika Ajuan Tidak Ditemukan', async () => {
    mockReq.body = validBody;
    mockReq.file = validFile;

    // Mock DB return null
    prisma.ajuanMagang.findUnique.mockResolvedValue(null);

    await kirimSuratPenerimaan(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ajuan Magang tidak ditemukan.',
      })
    );
  });

  it('TC-US15-004: Gagal jika Status Peserta Belum APPROVED', async () => {
    mockReq.body = validBody;
    mockReq.file = validFile;

    // Mock Status PENDING
    const mockAjuanPending = { ...mockAjuanApproved, statusUsulan: 'PENDING' };
    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanPending);

    await kirimSuratPenerimaan(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ajuan ini belum berstatus DITERIMA (APPROVED).',
      })
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('TC-US15-005: Gagal jika Surat Sudah Pernah Dikirim (Duplikat)', async () => {
    mockReq.body = validBody;
    mockReq.file = validFile;

    // Mock Surat Sudah Ada
    const mockAjuanDuplicate = {
      ...mockAjuanApproved,
      suratPenerimaan: { id: 'existing-surat-id' }, // Tidak null
    };
    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanDuplicate);

    await kirimSuratPenerimaan(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Surat penerimaan untuk ajuan ini sudah pernah dikirim.',
      })
    );
    expect(prisma.suratPenerimaan.create).not.toHaveBeenCalled();
  });

  it('TC-US15-006: Gagal (Server Error) jika terjadi kesalahan database', async () => {
    mockReq.body = validBody;
    mockReq.file = validFile;

    const dbError = new Error('DB Connection Failed');
    prisma.ajuanMagang.findUnique.mockRejectedValue(dbError);

    await kirimSuratPenerimaan(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(dbError);
  });
});
