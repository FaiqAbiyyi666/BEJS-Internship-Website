const { kirimSertifikat } = require('../controllers/sertifikat.controller'); 
const { prisma } = require('../utils/database'); 
const ejs = require('ejs');
const sendEmail = require('../utils/sendEmail'); 

jest.mock('../utils/database', () => ({
  prisma: {
    ajuanMagang: { findUnique: jest.fn() },
    sertifikat: { create: jest.fn() },
  },
}));

// 2. Mock EJS & Email
jest.mock('ejs', () => ({
  renderFile: jest.fn(),
}));

jest.mock('../utils/sendEmail', () => jest.fn());

// --- TEST SUITE ---

describe('Sertifikat Controller - kirimSertifikat', () => {
  let req, res;

  beforeEach(() => {
    // Reset req & res sebelum tiap test
    req = {
      body: {
        ajuanId: 100,
        noSertifikat: 'NO/SERT/001',
        nilai: 95,
        fileUrl: 'https://storage.com/sertifikat.pdf',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // --- HELPER UNTUK TANGGAL ---
  // Membuat tanggal relatif terhadap hari ini
  const getDate = (daysDifference) => {
    const date = new Date();
    date.setDate(date.getDate() + daysDifference);
    return date;
  };

  // --- DATA DUMMY UTAMA ---
  // Skenario: Magang 10 Hari (Mulai H-11, Selesai H-1)
  // Hari ini magang sudah selesai.
  const tglSelesaiLampau = getDate(-1);
  const tglMulaiLampau = getDate(-11);
  // Total hari = 10 hari (termasuk start & end)

  const mockAjuanValid = {
    id: 100,
    statusUsulan: 'APPROVED',
    tglMulai: tglMulaiLampau,
    tglSelesai: tglSelesaiLampau,
    laporan: { id: 1 }, // Sudah ada laporan
    ulasan: { id: 1 }, // Sudah ada ulasan
    sertifikat: null, // Belum ada sertifikat
    _count: {
      logbook: 11, // Logbook cukup (Target 11 hari karena +1 di rumus controller)
    },
    bidang: { nama: 'IT Support' },
    peserta: {
      id: 50,
      namaLengkap: 'Budi Santoso',
      user: { email: 'budi@example.com' },
    },
  };

  // --- SKENARIO POSITIF ---

  it('harus berhasil mengirim sertifikat (201) jika semua syarat terpenuhi', async () => {
    // 1. Mock Find Ajuan (Data Valid)
    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanValid);

    // 2. Mock Create Sertifikat
    prisma.sertifikat.create.mockResolvedValue({
      id: 1,
      noSertifikat: req.body.noSertifikat,
      nilai: req.body.nilai,
      fileUrl: req.body.fileUrl,
    });

    // 3. Mock EJS & Email (Sukses)
    ejs.renderFile.mockImplementation((path, data, cb) =>
      cb(null, '<html>Html</html>')
    );
    sendEmail.mockResolvedValue(true);

    await kirimSertifikat(req, res);

    // Assertions
    expect(prisma.sertifikat.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: true,
        message:
          'Sertifikat berhasil dikirim dan notifikasi email sedang diproses.',
      })
    );
  });

  it('harus tetap return 201 (dengan warning) jika email peserta tidak ada', async () => {
    // Clone data valid & hapus email
    const ajuanNoEmail = {
      ...mockAjuanValid,
      peserta: { ...mockAjuanValid.peserta, user: { email: null } },
    };

    prisma.ajuanMagang.findUnique.mockResolvedValue(ajuanNoEmail);
    prisma.sertifikat.create.mockResolvedValue({ id: 1 });

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'PERINGATAN: Notifikasi email GAGAL terkirim'
        ),
      })
    );
    // Pastikan sendEmail TIDAK dipanggil
    expect(sendEmail).not.toHaveBeenCalled();
  });

  // --- SKENARIO NEGATIF (VALIDASI REQUEST) ---

  it('harus return 400 jika body request tidak lengkap', async () => {
    req.body.noSertifikat = undefined; // Hapus salah satu field wajib

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ajuan, nomor sertifikat, nilai, dan file wajib diisi.',
      })
    );
    // Database tidak boleh dipanggil
    expect(prisma.ajuanMagang.findUnique).not.toHaveBeenCalled();
  });

  // --- SKENARIO NEGATIF (DATA DATABASE) ---

  it('harus return 404 jika ajuan tidak ditemukan', async () => {
    prisma.ajuanMagang.findUnique.mockResolvedValue(null);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gagal. Data ajuan magang tidak ditemukan.',
      })
    );
  });

  it('harus return 400 jika status ajuan bukan APPROVED', async () => {
    const ajuanPending = { ...mockAjuanValid, statusUsulan: 'PENDING' };
    prisma.ajuanMagang.findUnique.mockResolvedValue(ajuanPending);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Ajuan magang belum disetujui'),
      })
    );
  });

  it('harus return 400 jika sertifikat sudah pernah diterbitkan', async () => {
    const ajuanSudahAdaSertif = { ...mockAjuanValid, sertifikat: { id: 99 } };
    prisma.ajuanMagang.findUnique.mockResolvedValue(ajuanSudahAdaSertif);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gagal. Sertifikat untuk ajuan ini sudah pernah diterbitkan.',
      })
    );
  });

  // --- SKENARIO NEGATIF (LOGIKA BISNIS: TANGGAL & PRASYARAT) ---

  it('harus return 400 jika magang belum selesai (Tanggal Selesai > Hari Ini)', async () => {
    // Set tanggal selesai BESOK
    const tglSelesaiBesok = getDate(1);
    const ajuanBelumSelesai = {
      ...mockAjuanValid,
      tglSelesai: tglSelesaiBesok,
    };

    prisma.ajuanMagang.findUnique.mockResolvedValue(ajuanBelumSelesai);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Periode magang belum selesai'),
      })
    );
  });

  it('harus return 400 jika laporan akhir belum ada', async () => {
    const ajuanTanpaLaporan = { ...mockAjuanValid, laporan: null };
    prisma.ajuanMagang.findUnique.mockResolvedValue(ajuanTanpaLaporan);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gagal. Peserta belum mengunggah laporan akhir.',
      })
    );
  });

  it('harus return 400 jika ulasan belum diisi', async () => {
    const ajuanTanpaUlasan = { ...mockAjuanValid, ulasan: null };
    prisma.ajuanMagang.findUnique.mockResolvedValue(ajuanTanpaUlasan);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gagal. Peserta belum mengisi ulasan magang.',
      })
    );
  });

  it('harus return 400 jika jumlah logbook kurang', async () => {
    // Durasi magang di mockAjuanValid adalah sekitar 11 hari
    // Kita set logbook cuma 2
    const ajuanLogbookKurang = {
      ...mockAjuanValid,
      _count: { logbook: 2 },
    };
    prisma.ajuanMagang.findUnique.mockResolvedValue(ajuanLogbookKurang);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Logbook peserta belum lengkap'),
      })
    );
  });

  // --- SKENARIO ERROR DATABASE ---

  it('harus return 404 jika Prisma Error P2025 (Record Not Found saat create)', async () => {
    prisma.ajuanMagang.findUnique.mockResolvedValue(mockAjuanValid);

    const prismaError = new Error('Record not found');
    prismaError.code = 'P2025';

    // Gagal saat create sertifikat (misal ajuanId tiba-tiba hilang/race condition)
    prisma.sertifikat.create.mockRejectedValue(prismaError);

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gagal mengirim sertifikat. Peserta magang tidak ditemukan.',
      })
    );
  });

  it('harus return 500 jika terjadi Generic DB Error', async () => {
    prisma.ajuanMagang.findUnique.mockRejectedValue(
      new Error('Connection Failed')
    );

    await kirimSertifikat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Terjadi kesalahan pada server.',
      data: null,
    });
  });
});
