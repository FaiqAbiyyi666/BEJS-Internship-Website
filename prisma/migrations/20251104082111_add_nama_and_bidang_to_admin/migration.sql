-- AlterTable
ALTER TABLE `admin` ADD COLUMN `bidang_id` VARCHAR(191) NULL,
    ADD COLUMN `nama` VARCHAR(191) NOT NULL DEFAULT 'Administrator';

-- AddForeignKey
ALTER TABLE `Admin` ADD CONSTRAINT `Admin_bidang_id_fkey` FOREIGN KEY (`bidang_id`) REFERENCES `KuotaBidang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
