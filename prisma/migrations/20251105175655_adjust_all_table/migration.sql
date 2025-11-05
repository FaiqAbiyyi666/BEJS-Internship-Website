/*
  Warnings:

  - You are about to alter the column `status_usulan` on the `ajuanmagang` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(2))`.
  - You are about to drop the column `pas_foto` on the `berkasmagang` table. All the data in the column will be lost.
  - You are about to drop the column `peserta_id` on the `berkasmagang` table. All the data in the column will be lost.
  - You are about to drop the column `surat_bakesbangpol_sby` on the `berkasmagang` table. All the data in the column will be lost.
  - You are about to drop the column `peserta_id` on the `laporanhasilmagang` table. All the data in the column will be lost.
  - You are about to drop the column `peserta_id` on the `logbook` table. All the data in the column will be lost.
  - You are about to drop the column `bidang` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `peserta_id` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `tgl_mulai` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `tgl_selesai` on the `sertifikat` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ajuan_id]` on the table `BerkasMagang` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ajuan_id]` on the table `LaporanHasilMagang` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ajuan_id,tanggal]` on the table `Logbook` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ajuan_id]` on the table `Sertifikat` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ajuan_id` to the `BerkasMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ktp` to the `BerkasMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ajuan_id` to the `LaporanHasilMagang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ajuan_id` to the `Logbook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ajuan_id` to the `Sertifikat` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `berkasmagang` DROP FOREIGN KEY `BerkasMagang_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `laporanhasilmagang` DROP FOREIGN KEY `LaporanHasilMagang_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `logbook` DROP FOREIGN KEY `Logbook_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `sertifikat` DROP FOREIGN KEY `Sertifikat_peserta_id_fkey`;

-- DropIndex
DROP INDEX `BerkasMagang_peserta_id_fkey` ON `berkasmagang`;

-- DropIndex
DROP INDEX `LaporanHasilMagang_peserta_id_fkey` ON `laporanhasilmagang`;

-- DropIndex
DROP INDEX `Logbook_peserta_id_tanggal_key` ON `logbook`;

-- DropIndex
DROP INDEX `Sertifikat_peserta_id_fkey` ON `sertifikat`;

-- AlterTable
ALTER TABLE `ajuanmagang` MODIFY `instansi` VARCHAR(191) NULL,
    MODIFY `jurusan` VARCHAR(191) NULL,
    MODIFY `status_usulan` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `berkasmagang` DROP COLUMN `pas_foto`,
    DROP COLUMN `peserta_id`,
    DROP COLUMN `surat_bakesbangpol_sby`,
    ADD COLUMN `ajuan_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `ktp` VARCHAR(191) NOT NULL,
    ADD COLUMN `surat_bakesbangpol_prov` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `laporanhasilmagang` DROP COLUMN `peserta_id`,
    ADD COLUMN `ajuan_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `logbook` DROP COLUMN `peserta_id`,
    ADD COLUMN `ajuan_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `pesertamagang` MODIFY `instansi` VARCHAR(191) NULL,
    MODIFY `jurusan` VARCHAR(191) NULL,
    MODIFY `nim_nis` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sertifikat` DROP COLUMN `bidang`,
    DROP COLUMN `peserta_id`,
    DROP COLUMN `tgl_mulai`,
    DROP COLUMN `tgl_selesai`,
    ADD COLUMN `ajuan_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `BerkasMagang_ajuan_id_key` ON `BerkasMagang`(`ajuan_id`);

-- CreateIndex
CREATE UNIQUE INDEX `LaporanHasilMagang_ajuan_id_key` ON `LaporanHasilMagang`(`ajuan_id`);

-- CreateIndex
CREATE UNIQUE INDEX `Logbook_ajuan_id_tanggal_key` ON `Logbook`(`ajuan_id`, `tanggal`);

-- CreateIndex
CREATE UNIQUE INDEX `Sertifikat_ajuan_id_key` ON `Sertifikat`(`ajuan_id`);

-- AddForeignKey
ALTER TABLE `Logbook` ADD CONSTRAINT `Logbook_ajuan_id_fkey` FOREIGN KEY (`ajuan_id`) REFERENCES `AjuanMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaporanHasilMagang` ADD CONSTRAINT `LaporanHasilMagang_ajuan_id_fkey` FOREIGN KEY (`ajuan_id`) REFERENCES `AjuanMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sertifikat` ADD CONSTRAINT `Sertifikat_ajuan_id_fkey` FOREIGN KEY (`ajuan_id`) REFERENCES `AjuanMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BerkasMagang` ADD CONSTRAINT `BerkasMagang_ajuan_id_fkey` FOREIGN KEY (`ajuan_id`) REFERENCES `AjuanMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
