-- CreateEnum
CREATE TYPE "LibraryDocsLanguage" AS ENUM ('PYTHON', 'CPP');

-- CreateEnum
CREATE TYPE "LibraryDocsGenerationStatus" AS ENUM ('PENDING', 'CLONING', 'PARSING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "library_docs_generations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "language" "LibraryDocsLanguage" NOT NULL,
    "branch" TEXT,
    "packagePath" TEXT,
    "status" "LibraryDocsGenerationStatus" NOT NULL,
    "error" BYTEA,
    "resultS3Key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_docs_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_docs_generations_orgId_idx" ON "library_docs_generations"("orgId");

-- CreateIndex
CREATE INDEX "library_docs_generations_status_idx" ON "library_docs_generations"("status");
