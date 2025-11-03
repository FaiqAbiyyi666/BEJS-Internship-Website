-- CreateTable
CREATE TABLE `StatistikPengunjung` (
    `tahun` INTEGER NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`tahun`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
