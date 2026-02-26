-- CreateTable
CREATE TABLE "CachedEnhancedExample" (
    "requestHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "basepath" TEXT NOT NULL DEFAULT '',
    "method" "HttpMethod" NOT NULL,
    "endpointPath" TEXT NOT NULL,
    "enhancedRequestExample" BYTEA,
    "enhancedResponseExample" BYTEA,
    "modelUsed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CachedEnhancedExample_pkey" PRIMARY KEY ("requestHash")
);

-- CreateIndex
CREATE INDEX "CachedEnhancedExample_organizationId_method_endpointPath_idx" ON "CachedEnhancedExample"("organizationId", "method", "endpointPath");

-- CreateIndex
CREATE INDEX "CachedEnhancedExample_domain_basepath_idx" ON "CachedEnhancedExample"("domain", "basepath");
