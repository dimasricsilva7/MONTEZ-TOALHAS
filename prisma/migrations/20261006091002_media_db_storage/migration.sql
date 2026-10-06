-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "data" BYTEA,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "storage" TEXT NOT NULL DEFAULT 'blob';
