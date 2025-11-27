// Import controller langsung (karena helper ada di dalamnya)
const { createLogbook } = require('../controllers/logbook.controller');
const { prisma } = require('../utils/database');

jest.mock('../utils/database', () => ({
  prisma: {
    logbook: {
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(), 
    },
  },
}));

describe('Logbook Controller - createLogbook (Internal Helper)', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 123 }, // Mock User ID dari Token/Middleware
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // --- DATA DUMMY UNTUK MOCK PRISMA ---
  // Kita siapkan struktur data yang diharapkan oleh 'getApprovedInternData'
  const mockUserWithAjuan = {
    id: 123,
    pesertaMagang: {
      id: 999, // ID Peserta
      ajuan: [
        {
          id: 1, // ID Ajuan
          statusUsulan: 'APPROVED',
          tglMulai: new Date('2023-10-01T00:00:00Z'),
          tglSelesai: new Date('2023-10-31T00:00:00Z'),
        },
      ],
    },
  };

  // --- SKENARIO POSITIF ---

  it('harus berhasil menyimpan logbook (status 200) jika data valid', async () => {
    // 1. Setup Input
    req.body = {
      tanggal: '2023-10-15',
      deskripsi: 'Mengerjakan Unit Test',
      logbookFileUrl: 'http://example.com/bukti.jpg',
    };

    // 2. Mocking Prisma User (Pengganti Mock Helper)
    // Saat helper jalan, dia akan panggil prisma.user.findUnique, kita kasih data palsu ini.
    prisma.user.findUnique.mockResolvedValue(mockUserWithAjuan);

    // 3. Mocking Prisma Logbook (Simpan data)
    prisma.logbook.upsert.mockResolvedValue({
      id: 50,
      tanggal: new Date('2023-10-15'),
      deskripsi: 'Mengerjakan Unit Test',
    });

    // 4. Act
    await createLogbook(req, res);

    // 5. Assert
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 123 },
      })
    );
    expect(prisma.logbook.upsert).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Logbook berhasil disimpan' })
    );
  });

  // --- SKENARIO NEGATIF (VALIDASI INPUT) ---

  it('harus return 400 jika tanggal kosong', async () => {
    req.body = { deskripsi: 'Lupa tanggal' };

    await createLogbook(req, res);

    // Tidak perlu mock prisma karena validasi terjadi di awal
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Tanggal dan deskripsi wajib diisi',
    });
  });

  // --- SKENARIO NEGATIF (LOGIKA TANGGAL) ---

  it('harus return 400 jika tanggal di masa depan', async () => {
    // KITA GUNAKAN TANGGAL DINAMIS (BESOK) AGAR SELALU VALID KAPANPUN DITES
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    req.body = {
      tanggal: tomorrowStr,
      deskripsi: 'Mencoba isi masa depan',
    };

    // Helper mock data magang di masa lalu
    prisma.user.findUnique.mockResolvedValue(mockUserWithAjuan);

    await createLogbook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('masa depan'),
      })
    );
  });

  it('harus return 400 jika tanggal di luar periode magang', async () => {
    // Periode Mock User kita adalah: Oktober 2023 (2023-10-01 s/d 2023-10-31)
    // Kita coba input tanggal lampau TAPI di luar bulan Oktober
    req.body = {
      tanggal: '2023-09-01', // September (Sebelum mulai)
      deskripsi: 'Belum mulai magang',
    };

    prisma.user.findUnique.mockResolvedValue(mockUserWithAjuan);

    await createLogbook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    // PERBAIKAN DISINI: Kita ekspektasikan pesan "periode magang", bukan "masa depan"
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('berada dalam periode magang'),
      })
    );
  });

  // --- SKENARIO ERROR AKSES (HELPER INTERNAL ERROR) ---

  it('harus return 403 jika user bukan peserta magang (Error Helper)', async () => {
    req.body = { tanggal: '2023-10-15', deskripsi: 'Hacker' };

    // Kita simulasikan prisma return null (User tidak ketemu)
    // atau return user tanpa properti pesertaMagang
    prisma.user.findUnique.mockResolvedValue({ id: 123, pesertaMagang: null });

    await createLogbook(req, res);

    // Controller akan menangkap error dari helper dan return 403
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Hanya peserta magang'),
      })
    );
  });

  it('harus return 403 jika user tidak punya ajuan APPROVED (Error Helper)', async () => {
    req.body = { tanggal: '2023-10-15', deskripsi: 'Belum diterima' };

    // User ada, Peserta ada, tapi ajuan kosong
    prisma.user.findUnique.mockResolvedValue({
      id: 123,
      pesertaMagang: {
        id: 999,
        ajuan: [], // Kosong, tidak ada yang approved
      },
    });

    await createLogbook(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('tidak memiliki ajuan'),
      })
    );
  });
});
