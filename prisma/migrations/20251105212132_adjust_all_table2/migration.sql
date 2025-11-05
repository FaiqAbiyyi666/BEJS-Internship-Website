/*
  Warnings:

  - Made the column `instagram` on table `pesertamagang` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `pesertamagang` MODIFY `instagram` VARCHAR(191) NOT NULL;
