-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'peserta_mag', 'sub_koordinator_bidang') NOT NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PesertaMagang` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `nim` VARCHAR(191) NOT NULL,
    `instansi` VARCHAR(191) NOT NULL,
    `jurusan` VARCHAR(191) NOT NULL,
    `alamat` VARCHAR(191) NOT NULL,
    `noTelepon` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `PesertaMagang_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AjuanMagang` (
    `id` VARCHAR(191) NOT NULL,
    `pesertaId` VARCHAR(191) NOT NULL,
    `bidangId` VARCHAR(191) NOT NULL,
    `jenisMagang` VARCHAR(191) NOT NULL,
    `jenjang` VARCHAR(191) NOT NULL,
    `statusPendidikan` VARCHAR(191) NOT NULL,
    `instansi` VARCHAR(191) NOT NULL,
    `temaMagang` VARCHAR(191) NOT NULL,
    `statusUsulan` VARCHAR(191) NOT NULL,
    `mulai` DATETIME(3) NOT NULL,
    `selesai` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KuotaBidang` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `kuota` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Logbook` (
    `id` VARCHAR(191) NOT NULL,
    `pesertaId` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `deskripsi` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PesertaMagang` ADD CONSTRAINT `PesertaMagang_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjuanMagang` ADD CONSTRAINT `AjuanMagang_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `PesertaMagang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjuanMagang` ADD CONSTRAINT `AjuanMagang_bidangId_fkey` FOREIGN KEY (`bidangId`) REFERENCES `KuotaBidang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Logbook` ADD CONSTRAINT `Logbook_pesertaId_fkey` FOREIGN KEY (`pesertaId`) REFERENCES `PesertaMagang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
