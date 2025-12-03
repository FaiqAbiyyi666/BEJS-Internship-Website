/*
  Warnings:

  - Added the required column `foto_ktp` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `pesertamagang` ADD COLUMN `foto_ktp` VARCHAR(191) NOT NULL;
