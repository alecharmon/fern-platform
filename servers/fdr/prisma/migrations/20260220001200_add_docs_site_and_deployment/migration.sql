-- CreateEnum
CREATE TYPE "DocsDeploymentStatus" AS ENUM ('PUBLISHING', 'LIVE', 'UNPUBLISHED', 'ERROR');

-- CreateTable
CREATE TABLE "docs_sites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "basepath" TEXT NOT NULL DEFAULT '',
    "previewUrl" TEXT,
    "status" "DocsDeploymentStatus" NOT NULL DEFAULT 'PUBLISHING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "docs_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docs_deployments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "basepath" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "status" "DocsDeploymentStatus" NOT NULL DEFAULT 'PUBLISHING',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "previewUrl" TEXT,
    "metadata" JSONB,

    CONSTRAINT "docs_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "docs_sites_orgId_domain_basepath_key" ON "docs_sites"("orgId", "domain", "basepath");

-- CreateIndex
CREATE INDEX "docs_deployments_domain_basepath_createdAt_idx" ON "docs_deployments"("domain", "basepath", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "docs_deployments_domain_basepath_status_createdAt_idx" ON "docs_deployments"("domain", "basepath", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "docs_deployments_orgId_idx" ON "docs_deployments"("orgId");

-- AlterTable
ALTER TABLE "DocsRegistrations" ADD COLUMN "deploymentId" TEXT;
