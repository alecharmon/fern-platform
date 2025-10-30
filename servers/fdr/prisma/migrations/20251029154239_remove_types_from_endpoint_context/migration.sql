-- CreateTable
CREATE TABLE "ApiDefinitionTypes" (
    "apiDefinitionId" TEXT NOT NULL,
    "types" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiDefinitionTypes_pkey" PRIMARY KEY ("apiDefinitionId")
);
