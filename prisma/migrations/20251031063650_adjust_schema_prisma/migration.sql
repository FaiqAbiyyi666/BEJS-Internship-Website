/*
  Warnings:

  - A unique constraint covering the columns `[peserta_id,tanggal]` on the table `Logbook` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `admin` DROP FOREIGN KEY `Admin_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `berkasmagang` DROP FOREIGN KEY `BerkasMagang_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `laporanhasilmagang` DROP FOREIGN KEY `LaporanHasilMagang_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `logbook` DROP FOREIGN KEY `Logbook_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `notifikasi` DROP FOREIGN KEY `Notifikasi_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `pesertamagang` DROP FOREIGN KEY `PesertaMagang_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `subkoordinatorbidang` DROP FOREIGN KEY `SubKoordinatorBidang_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ulasanmagang` DROP FOREIGN KEY `UlasanMagang_user_id_fkey`;

-- DropIndex
DROP INDEX `BerkasMagang_peserta_id_fkey` ON `berkasmagang`;

-- DropIndex
DROP INDEX `LaporanHasilMagang_peserta_id_fkey` ON `laporanhasilmagang`;

-- DropIndex
DROP INDEX `Logbook_peserta_id_fkey` ON `logbook`;

-- DropIndex
DROP INDEX `Notifikasi_user_id_fkey` ON `notifikasi`;

-- DropIndex
DROP INDEX `UlasanMagang_user_id_fkey` ON `ulasanmagang`;

-- AlterTable
ALTER TABLE `ajuanmagang` MODIFY `tgl_mulai` DATE NOT NULL,
    MODIFY `tgl_selesai` DATE NOT NULL;

-- AlterTable
ALTER TABLE `logbook` MODIFY `tanggal` DATE NOT NULL,
    MODIFY `deskripsi` TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX `Logbook_peserta_id_tanggal_key` ON `Logbook`(`peserta_id`, `tanggal`);

-- AddForeignKey
ALTER TABLE `PesertaMagang` ADD CONSTRAINT `PesertaMagang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin` ADD CONSTRAINT `Admin_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubKoordinatorBidang` ADD CONSTRAINT `SubKoordinatorBidang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Logbook` ADD CONSTRAINT `Logbook_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UlasanMagang` ADD CONSTRAINT `UlasanMagang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaporanHasilMagang` ADD CONSTRAINT `LaporanHasilMagang_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BerkasMagang` ADD CONSTRAINT `BerkasMagang_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notifikasi` ADD CONSTRAINT `Notifikasi_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
