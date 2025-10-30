CREATE TABLE "ApiEndpoint" (
    "apiDefinitionId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL,
    "path" TEXT NOT NULL,
    "endpoint" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiEndpoint_pkey" PRIMARY KEY ("apiDefinitionId","endpointId")
);

CREATE INDEX "ApiEndpoint_apiDefinitionId_method_path_idx" ON "ApiEndpoint"("apiDefinitionId", "method", "path");
