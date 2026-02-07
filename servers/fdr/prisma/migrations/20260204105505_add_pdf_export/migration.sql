-- CreateEnum
CREATE TYPE "PdfExportTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "pdf_export_tasks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "docsUrl" TEXT NOT NULL,
    "status" "PdfExportTaskStatus" NOT NULL DEFAULT 'PENDING',
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "s3Key" TEXT,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "pdf_export_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_export_tasks_orgId_docsUrl_idx" ON "pdf_export_tasks"("orgId", "docsUrl");

-- CreateIndex
CREATE INDEX "pdf_export_tasks_status_idx" ON "pdf_export_tasks"("status");
