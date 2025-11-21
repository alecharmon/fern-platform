-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('PUT', 'POST', 'GET', 'PATCH', 'DELETE', 'HEAD');

-- CreateTable
CREATE TABLE "CachedEnhancedExample" (
    "requestHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
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
