/*
  Warnings:

  - You are about to drop the column `is_approved` on the `pesertamagang` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `pesertamagang` DROP COLUMN `is_approved`,
    ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';
