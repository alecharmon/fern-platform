-- CreateTable
CREATE TABLE "global_org_configs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "config" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_org_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_org_configs_orgId_idx" ON "global_org_configs"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "global_org_configs_orgId_configId_key" ON "global_org_configs"("orgId", "configId");
