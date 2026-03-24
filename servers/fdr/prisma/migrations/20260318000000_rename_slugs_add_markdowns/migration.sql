-- CreateTable: slugs
CREATE TABLE "slugs" (
    "orgId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "basepath" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slugs_pkey" PRIMARY KEY ("domain","basepath","slug")
);

-- CreateIndex
CREATE INDEX "slugs_orgId_idx" ON "slugs"("orgId");

-- CreateIndex
CREATE INDEX "slugs_domain_basepath_idx" ON "slugs"("domain","basepath");

-- CreateTable: markdowns
CREATE TABLE "markdowns" (
    "domain" TEXT NOT NULL,
    "basepath" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markdowns_pkey" PRIMARY KEY ("domain","basepath","slug","pageId")
);

-- AddForeignKey
ALTER TABLE "markdowns" ADD CONSTRAINT "markdowns_domain_basepath_slug_fkey"
    FOREIGN KEY ("domain","basepath","slug") REFERENCES "slugs"("domain","basepath","slug") ON DELETE CASCADE ON UPDATE CASCADE;
