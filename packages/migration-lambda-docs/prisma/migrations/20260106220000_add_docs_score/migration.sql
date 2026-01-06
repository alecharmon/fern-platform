-- CreateTable
CREATE TABLE "docs_scores" (
    "domain" TEXT NOT NULL,
    "score" INTEGER,
    "isProcessing" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB,

    CONSTRAINT "docs_scores_pkey" PRIMARY KEY ("domain")
);
