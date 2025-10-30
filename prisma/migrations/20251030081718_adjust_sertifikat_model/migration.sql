/*
  Warnings:

  - Added the required column `bidang` to the `Sertifikat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_url` to the `Sertifikat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tgl_mulai` to the `Sertifikat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tgl_selesai` to the `Sertifikat` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `sertifikat` DROP FOREIGN KEY `Sertifikat_peserta_id_fkey`;

-- DropIndex
DROP INDEX `Sertifikat_peserta_id_fkey` ON `sertifikat`;

-- AlterTable
ALTER TABLE `sertifikat` ADD COLUMN `bidang` VARCHAR(191) NOT NULL,
    ADD COLUMN `file_url` VARCHAR(191) NOT NULL,
    ADD COLUMN `tgl_mulai` DATE NOT NULL,
    ADD COLUMN `tgl_selesai` DATE NOT NULL;

-- AddForeignKey
ALTER TABLE `Sertifikat` ADD CONSTRAINT `Sertifikat_peserta_id_fkey` FOREIGN KEY (`peserta_id`) REFERENCES `PesertaMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
