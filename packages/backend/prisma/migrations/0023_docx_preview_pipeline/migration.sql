CREATE TYPE "PreviewStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "Document"
ADD COLUMN "previewPdfKey" TEXT,
ADD COLUMN "previewStatus" "PreviewStatus" NOT NULL DEFAULT 'NONE';
