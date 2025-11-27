const { submitLaporan } = require('../controllers/laporanAkhir.controller');
const { prisma } = require('../utils/database');

// Mock Prisma
jest.mock('../utils/database', () => ({
  prisma: {
    pesertaMagang: { findUnique: jest.fn() },
    ajuanMagang: { findFirst: jest.fn() },
    laporanHasilMagang: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Laporan Akhir Controller - submitLaporan', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 123 },
      imagekit_file_info: { fileUrl: 'https://imagekit.io/laporan-akhir.pdf' }, // Mock middleware ImageKit
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // --- DATA DUMMY ---
  const mockPeserta = { id: 100 };

  // Helper untuk membuat tanggal selesai
  const getFutureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  };

  // --- SKENARIO POSITIF ---

  it('harus berhasil mengunggah laporan (201) jika masih dalam periode submit (H-7 selesai)', async () => {
    // Skenario: Magang selesai BESOK (artinya hari ini sudah masuk window 7 hari terakhir)
    const tglSelesaiValid = getFutureDate(1);

    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ajuanMagang.findFirst.mockResolvedValue({
      id: 50,
      tglSelesai: tglSelesaiValid, // Masih dalam range
    });
    // Belum ada laporan sebelumnya
    prisma.laporanHasilMagang.findFirst.mockResolvedValue(null);
    // Mock Create
    prisma.laporanHasilMagang.create.mockResolvedValue({
      id: 1,
      status: 'PENDING',
      fileLaporan: req.imagekit_file_info.fileUrl,
    });

    await submitLaporan(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Laporan berhasil diunggah.',
      })
    );
  });

  // --- SKENARIO NEGATIF (VALIDASI USER & AJUAN) ---

  it('harus return 404 jika profil peserta tidak ditemukan', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(null);

    await submitLaporan(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      msg: 'Profil peserta magang tidak ditemukan.',
    });
  });

  it('harus return 404 jika tidak ada ajuan APPROVED', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ajuanMagang.findFirst.mockResolvedValue(null); // Tidak ada ajuan

    await submitLaporan(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      msg: 'Tidak ditemukan ajuan magang yang disetujui untuk mengirim laporan.',
    });
  });

  // --- SKENARIO NEGATIF (LOGIKA TANGGAL) ---

  it('harus return 403 jika mencoba upload TERLALU AWAL (belum H-7 selesai)', async () => {
    // Skenario: Magang selesai 30 hari lagi (Belum boleh upload)
    const tglSelesaiJauh = getFutureDate(30);

    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ajuanMagang.findFirst.mockResolvedValue({
      id: 50,
      tglSelesai: tglSelesaiJauh,
    });

    await submitLaporan(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    // Cek pesan error mengandung kata-kata kunci
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('belum bisa mengirim laporan'),
      })
    );
  });

  // --- SKENARIO NEGATIF (DUPLIKASI) ---

  it('harus return 400 jika sudah pernah upload (Status PENDING/APPROVED)', async () => {
    const tglSelesaiValid = getFutureDate(1);

    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ajuanMagang.findFirst.mockResolvedValue({
      id: 50,
      tglSelesai: tglSelesaiValid,
    });
    // Sudah ada laporan
    prisma.laporanHasilMagang.findFirst.mockResolvedValue({
      id: 99,
      status: 'PENDING',
    });

    await submitLaporan(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      msg: 'Anda sudah memiliki laporan yang sedang direview atau sudah diterima untuk ajuan ini.',
    });
  });

  // --- SKENARIO ERROR SERVER ---

  it('harus return 500 jika terjadi error database', async () => {
    prisma.pesertaMagang.findUnique.mockRejectedValue(new Error('DB Error'));

    await submitLaporan(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ msg: 'Terjadi kesalahan server.' });
  });
});
