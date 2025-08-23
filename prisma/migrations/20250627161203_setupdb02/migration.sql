/*
  Warnings:

  - You are about to drop the column `bidangId` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `jenisMagang` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `jenjang` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `mulai` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `pesertaId` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `selesai` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `statusPendidikan` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `statusUsulan` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `temaMagang` on the `ajuanmagang` table. All the data in the column will be lost.
  - You are about to drop the column `pesertaId` on the `logbook` table. All the data in the column will be lost.
  - You are about to drop the column `nim` on the `pesertamagang` table. All the data in the column will be lost.
  - You are about to drop the column `noTelepon` on the `pesertamagang` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `pesertamagang` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `user` table. All the data in the column will be lost.
  - The values [peserta_mag] on the enum `User_role` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `PesertaMagang` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bidang_id` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jenis_magang` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jenjang_pendidikan` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jurusan` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kategori_magang` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `peserta_id` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status_pendidikan` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status_usulan` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tema_magang` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tgl_mulai` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tgl_selesai` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `AjuanMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `KuotaBidang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `peserta_id` to the `Logbook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Logbook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nik` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nim_nis` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `no_telepon` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `ajuanmagang` DROP FOREIGN KEY `AjuanMagang_bidangId_fkey`;

-- DropForeignKey
ALTER TABLE `ajuanmagang` DROP FOREIGN KEY `AjuanMagang_pesertaId_fkey`;

-- DropForeignKey
ALTER TABLE `logbook` DROP FOREIGN KEY `Logbook_pesertaId_fkey`;

-- DropForeignKey
ALTER TABLE `pesertamagang` DROP FOREIGN KEY `PesertaMagang_userId_fkey`;

-- DropIndex
DROP INDEX `AjuanMagang_bidangId_fkey` ON `ajuanmagang`;

-- DropIndex
DROP INDEX `AjuanMagang_pesertaId_fkey` ON `ajuanmagang`;

-- DropIndex
DROP INDEX `Logbook_pesertaId_fkey` ON `logbook`;

-- DropIndex
DROP INDEX `PesertaMagang_userId_key` ON `pesertamagang`;

-- AlterTable
ALTER TABLE `ajuanmagang` DROP COLUMN `bidangId`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `jenisMagang`,
    DROP COLUMN `jenjang`,
    DROP COLUMN `mulai`,
    DROP COLUMN `pesertaId`,
    DROP COLUMN `selesai`,
    DROP COLUMN `statusPendidikan`,
    DROP COLUMN `statusUsulan`,
    DROP COLUMN `temaMagang`,
    ADD COLUMN `bidang_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `jenis_magang` VARCHAR(191) NOT NULL,
    ADD COLUMN `jenjang_pendidikan` VARCHAR(191) NOT NULL,
    ADD COLUMN `jurusan` VARCHAR(191) NOT NULL,
    ADD COLUMN `kategori_magang` VARCHAR(191) NOT NULL,
    ADD COLUMN `peserta_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `status_pendidikan` VARCHAR(191) NOT NULL,
    ADD COLUMN `status_usulan` VARCHAR(191) NOT NULL,
    ADD COLUMN `tema_magang` VARCHAR(191) NOT NULL,
    ADD COLUMN `tgl_mulai` DATETIME(3) NOT NULL,
    ADD COLUMN `tgl_selesai` DATETIME(3) NOT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `kuotabidang` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `logbook` DROP COLUMN `pesertaId`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `peserta_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `pesertamagang` DROP COLUMN `nim`,
    DROP COLUMN `noTelepon`,
    DROP COLUMN `userId`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `nik` VARCHAR(191) NOT NULL,
    ADD COLUMN `nim_nis` VARCHAR(191) NOT NULL,
    ADD COLUMN `no_telepon` VARCHAR(191) NOT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    ADD COLUMN `user_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `createdAt`,
    DROP COLUMN `isVerified`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `is_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `role` ENUM('peserta_magang', 'admin', 'sub_koordinator_bidang') NOT NULL;

-- CreateTable
CREATE TABLE `Admin` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Admin_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubKoordinatorBidang` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `bidang_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SubKoordinatorBidang_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KritikSaran` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `pesan` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UlasanMagang` (
    `id` VARCHAR(191) NOT NULL,
    `ulasan` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LaporanHasilMagang` (
    `id` VARCHAR(191) NOT NULL,
    `file_laporan` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `peserta_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sertifikat` (
    `id` VARCHAR(191) NOT NULL,
    `no_sertifikat` VARCHAR(191) NOT NULL,
    `nilai` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `peserta_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BerkasMagang` (
    `id` VARCHAR(191) NOT NULL,
    `surat_pengantar` VARCHAR(191) NOT NULL,
    `proposal_magang` VARCHAR(191) NOT NULL,
    `cv` VARCHAR(191) NOT NULL,
    `pas_foto` VARCHAR(191) NOT NULL,
    `surat_bakesbangpol_sda` VARCHAR(191) NOT NULL,
    `surat_bakesbangpol_sby` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `peserta_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notifikasi` (
    `id` VARCHAR(191) NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `pesan` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `PesertaMagang_user_id_key` ON `PesertaMagang`(`user_id`);

-- AddForeignKey
ALTER TABLE `PesertaMagang` ADD CONSTRAINT `PesertaMagang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjuanMagang` ADD CONSTRAINT `AjuanMagang_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AjuanMagang` ADD CONSTRAINT `AjuanMagang_bidang_id_fkey` FOREIGN KEY (`bidang_id`) REFERENCES `KuotaBidang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin` ADD CONSTRAINT `Admin_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubKoordinatorBidang` ADD CONSTRAINT `SubKoordinatorBidang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubKoordinatorBidang` ADD CONSTRAINT `SubKoordinatorBidang_bidang_id_fkey` FOREIGN KEY (`bidang_id`) REFERENCES `KuotaBidang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Logbook` ADD CONSTRAINT `Logbook_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KritikSaran` ADD CONSTRAINT `KritikSaran_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UlasanMagang` ADD CONSTRAINT `UlasanMagang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaporanHasilMagang` ADD CONSTRAINT `LaporanHasilMagang_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sertifikat` ADD CONSTRAINT `Sertifikat_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BerkasMagang` ADD CONSTRAINT `BerkasMagang_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notifikasi` ADD CONSTRAINT `Notifikasi_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
