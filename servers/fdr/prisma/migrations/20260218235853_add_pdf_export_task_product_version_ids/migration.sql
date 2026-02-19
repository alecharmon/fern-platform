-- AlterTable
ALTER TABLE "pdf_export_tasks" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "versionId" TEXT;

-- CreateIndex
CREATE INDEX "pdf_export_tasks_orgId_productId_versionId_idx" ON "pdf_export_tasks"("orgId", "productId", "versionId");
