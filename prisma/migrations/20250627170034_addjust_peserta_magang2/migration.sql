/*
  Warnings:

  - You are about to drop the column `is_verified` on the `user` table. All the data in the column will be lost.
  - Added the required column `pas_foto` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `pesertamagang` ADD COLUMN `is_approved` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pas_foto` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `is_verified`;
