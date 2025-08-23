-- AlterTable
ALTER TABLE `pesertamagang` ADD COLUMN `bidang_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `PesertaMagang` ADD CONSTRAINT `PesertaMagang_bidang_id_fkey` FOREIGN KEY (`bidang_id`) REFERENCES `KuotaBidang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
