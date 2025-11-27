const { createUlasan } = require('../controllers/ulasanMagang.controller'); // Sesuaikan path
const { prisma } = require('../utils/database');

// Mock Database
jest.mock('../utils/database', () => ({
  prisma: {
    pesertaMagang: { findUnique: jest.fn() },
    ulasanMagang: { findFirst: jest.fn(), create: jest.fn() },
    ajuanMagang: { findFirst: jest.fn() },
    logbook: { count: jest.fn() },
  },
}));

// --- HELPER TEST ---
const getPastDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const getFutureDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

describe('Ulasan Controller - createUlasan', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {
        ajuanId: 10,
        ulasan: 'Pengalaman sangat berharga!',
        rating: 5,
      },
      user: { id: 'user-123' }, // User login
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  // --- DATA DUMMY ---
  // Skenario: Magang 10 Hari, sudah selesai kemarin.
  const tglMulai = getPastDate(11); // 11 hari lalu
  const tglSelesai = getPastDate(1); // 1 hari lalu (Sudah selesai)
  // Total hari logbook yang diharapkan ~11 hari

  const mockPeserta = { id: 99 };

  const mockAjuanValid = {
    id: 10,
    tglMulai: tglMulai,
    tglSelesai: tglSelesai,
    ulasan: null, // Belum ada ulasan di ajuan ini
    laporan: { id: 500, status: 'APPROVED' }, // Laporan sudah OK
  };

  // --- SKENARIO POSITIF ---

  it('harus berhasil membuat ulasan (201) jika semua syarat terpenuhi', async () => {
    // 1. Cek Peserta
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    // 2. Cek Existing Ulasan Global (Belum ada)
    prisma.ulasanMagang.findFirst.mockResolvedValue(null);
    // 3. Cek Ajuan (Valid, milik user, sudah selesai)
    prisma.ajuanMagang.findFirst.mockResolvedValue(mockAjuanValid);
    // 4. Cek Logbook (Lengkap)
    // Asumsi durasi 11 hari, kita mock count logbook = 11
    prisma.logbook.count.mockResolvedValue(11);
    // 5. Create Ulasan
    const newUlasan = { id: 1, ...req.body };
    prisma.ulasanMagang.create.mockResolvedValue(newUlasan);

    // Kita perlu menghitung hari manual agar mock calculateTotalDays (jika embedded) cocok
    // Namun karena calculateTotalDays adalah fungsi logika, kita akali dengan
    // memastikan prisma.logbook.count mengembalikan angka yang >= durasi hari di mockAjuanValid

    await createUlasan(req, res, next);

    expect(prisma.ulasanMagang.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ulasan magang berhasil dikirim!',
        data: newUlasan,
      })
    );
  });

  // --- SKENARIO NEGATIF (AUTH & VALIDASI) ---

  it('harus return 401 jika user belum login', async () => {
    req.user = undefined;

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Anda harus login untuk mengirim ulasan.',
      data: null,
    });
  });

  it('harus return 400 jika body tidak lengkap', async () => {
    req.body.rating = undefined; // Hapus rating

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Ajuan ID, ulasan, dan rating wajib diisi.',
    });
  });

  it('harus return 403 jika user bukan peserta magang', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(null);

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Hanya peserta magang yang dapat mengirim ulasan.',
    });
  });

  // --- SKENARIO NEGATIF (DUPLIKASI) ---

  it('harus return 409 jika user sudah pernah memberi ulasan (Cek Global)', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    // Mock ulasan sudah ada
    prisma.ulasanMagang.findFirst.mockResolvedValue({ id: 1 });

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Anda sudah pernah mengirim ulasan.',
    });
  });

  it('harus return 409 jika ajuan ini sudah memiliki ulasan (Cek Spesifik)', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ulasanMagang.findFirst.mockResolvedValue(null); // Lolos cek global

    // Mock ajuan yang SUDAH punya ulasan
    const ajuanWithUlasan = { ...mockAjuanValid, ulasan: { id: 5 } };
    prisma.ajuanMagang.findFirst.mockResolvedValue(ajuanWithUlasan);

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Anda sudah pernah mengirim ulasan untuk magang ini.',
    });
  });

  // --- SKENARIO NEGATIF (LOGIKA BISNIS) ---

  it('harus return 404 jika ajuan tidak ditemukan', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ulasanMagang.findFirst.mockResolvedValue(null);
    prisma.ajuanMagang.findFirst.mockResolvedValue(null);

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Data ajuan magang tidak ditemukan atau bukan milik Anda.',
    });
  });

  it('harus return 403 jika periode magang belum selesai', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ulasanMagang.findFirst.mockResolvedValue(null);

    // Mock selesai besok
    const tglSelesaiBesok = getFutureDate(1);
    const ajuanBelumSelesai = {
      ...mockAjuanValid,
      tglSelesai: tglSelesaiBesok,
    };
    prisma.ajuanMagang.findFirst.mockResolvedValue(ajuanBelumSelesai);

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Anda baru bisa memberi ulasan setelah periode magang berakhir'
        ),
      })
    );
  });

  it('harus return 403 jika belum upload laporan', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ulasanMagang.findFirst.mockResolvedValue(null);

    // Laporan null
    const ajuanNoLaporan = { ...mockAjuanValid, laporan: null };
    prisma.ajuanMagang.findFirst.mockResolvedValue(ajuanNoLaporan);

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Anda harus mengirim Laporan Hasil Magang terlebih dahulu.',
    });
  });

  it('harus return 403 jika laporan belum APPROVED', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ulasanMagang.findFirst.mockResolvedValue(null);

    // Status PENDING
    const ajuanLaporanPending = {
      ...mockAjuanValid,
      laporan: { id: 500, status: 'PENDING' },
    };
    prisma.ajuanMagang.findFirst.mockResolvedValue(ajuanLaporanPending);

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Laporan Anda harus berstatus "APPROVED"'
        ),
      })
    );
  });

  it('harus return 403 jika logbook belum lengkap', async () => {
    prisma.pesertaMagang.findUnique.mockResolvedValue(mockPeserta);
    prisma.ulasanMagang.findFirst.mockResolvedValue(null);
    prisma.ajuanMagang.findFirst.mockResolvedValue(mockAjuanValid);

    // Asumsi durasi 11 hari, tapi logbook cuma 5
    prisma.logbook.count.mockResolvedValue(5);

    await createUlasan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Anda harus melengkapi semua logbook harian'
        ),
      })
    );
  });

  // --- SKENARIO ERROR ---

  it('harus memanggil next(error) jika terjadi database error', async () => {
    prisma.pesertaMagang.findUnique.mockRejectedValue(new Error('DB Error'));

    await createUlasan(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
