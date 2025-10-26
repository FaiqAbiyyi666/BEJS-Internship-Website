/*
  Warnings:

  - You are about to drop the column `jenis_magang` on the `ajuanmagang` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `admin` DROP FOREIGN KEY `Admin_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `berkasmagang` DROP FOREIGN KEY `BerkasMagang_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `kritiksaran` DROP FOREIGN KEY `KritikSaran_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `laporanhasilmagang` DROP FOREIGN KEY `LaporanHasilMagang_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `logbook` DROP FOREIGN KEY `Logbook_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `notifikasi` DROP FOREIGN KEY `Notifikasi_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `pesertamagang` DROP FOREIGN KEY `PesertaMagang_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `sertifikat` DROP FOREIGN KEY `Sertifikat_peserta_id_fkey`;

-- DropForeignKey
ALTER TABLE `subkoordinatorbidang` DROP FOREIGN KEY `SubKoordinatorBidang_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ulasanmagang` DROP FOREIGN KEY `UlasanMagang_user_id_fkey`;

-- DropIndex
DROP INDEX `BerkasMagang_peserta_id_fkey` ON `berkasmagang`;

-- DropIndex
DROP INDEX `KritikSaran_user_id_fkey` ON `kritiksaran`;

-- DropIndex
DROP INDEX `LaporanHasilMagang_peserta_id_fkey` ON `laporanhasilmagang`;

-- DropIndex
DROP INDEX `Logbook_peserta_id_fkey` ON `logbook`;

-- DropIndex
DROP INDEX `Notifikasi_user_id_fkey` ON `notifikasi`;

-- DropIndex
DROP INDEX `Sertifikat_peserta_id_fkey` ON `sertifikat`;

-- DropIndex
DROP INDEX `UlasanMagang_user_id_fkey` ON `ulasanmagang`;

-- AlterTable
ALTER TABLE `ajuanmagang` DROP COLUMN `jenis_magang`;

-- AddForeignKey
ALTER TABLE `PesertaMagang` ADD CONSTRAINT `PesertaMagang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin` ADD CONSTRAINT `Admin_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubKoordinatorBidang` ADD CONSTRAINT `SubKoordinatorBidang_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
