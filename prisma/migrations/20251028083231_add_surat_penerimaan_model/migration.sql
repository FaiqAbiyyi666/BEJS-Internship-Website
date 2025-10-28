-- CreateTable
CREATE TABLE `SuratPenerimaan` (
    `id` VARCHAR(191) NOT NULL,
    `no_surat` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `file_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ajuan_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `SuratPenerimaan_ajuan_id_key`(`ajuan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SuratPenerimaan` ADD CONSTRAINT `SuratPenerimaan_ajuan_id_fkey` FOREIGN KEY (`ajuan_id`) REFERENCES `AjuanMagang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
