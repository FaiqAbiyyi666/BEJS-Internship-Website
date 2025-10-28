-- DropForeignKey
ALTER TABLE `kritiksaran` DROP FOREIGN KEY `KritikSaran_user_id_fkey`;

-- DropIndex
DROP INDEX `KritikSaran_user_id_fkey` ON `kritiksaran`;

-- AlterTable
ALTER TABLE `kritiksaran` MODIFY `user_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `KritikSaran` ADD CONSTRAINT `KritikSaran_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
