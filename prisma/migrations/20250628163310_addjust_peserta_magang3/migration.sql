/*
  Warnings:

  - Added the required column `tgl_lahir` to the `PesertaMagang` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `pesertamagang` ADD COLUMN `tgl_lahir` DATETIME(3) NOT NULL;
