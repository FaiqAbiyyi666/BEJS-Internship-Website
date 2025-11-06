/*
  Warnings:

  - You are about to drop the column `user_id` on the `ulasanmagang` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ajuan_id]` on the table `UlasanMagang` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ajuan_id` to the `UlasanMagang` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `ulasanmagang` DROP FOREIGN KEY `UlasanMagang_user_id_fkey`;

-- DropIndex
DROP INDEX `UlasanMagang_user_id_fkey` ON `ulasanmagang`;

-- AlterTable
ALTER TABLE `ulasanmagang` DROP COLUMN `user_id`,
    ADD COLUMN `ajuan_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `UlasanMagang_ajuan_id_key` ON `UlasanMagang`(`ajuan_id`);

-- AddForeignKey
ALTER TABLE `UlasanMagang` ADD CONSTRAINT `UlasanMagang_ajuan_id_fkey` FOREIGN KEY (`ajuan_id`) REFERENCES `AjuanMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
