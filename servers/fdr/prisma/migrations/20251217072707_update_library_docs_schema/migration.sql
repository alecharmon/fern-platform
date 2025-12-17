/*
  Warnings:

  - The values [CLONING,GENERATING] on the enum `LibraryDocsGenerationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `resultS3Key` on the `library_docs_generations` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LibraryDocsGenerationStatus_new" AS ENUM ('PENDING', 'PARSING', 'COMPLETED', 'FAILED');
ALTER TABLE "library_docs_generations" ALTER COLUMN "status" TYPE "LibraryDocsGenerationStatus_new" USING ("status"::text::"LibraryDocsGenerationStatus_new");
ALTER TYPE "LibraryDocsGenerationStatus" RENAME TO "LibraryDocsGenerationStatus_old";
ALTER TYPE "LibraryDocsGenerationStatus_new" RENAME TO "LibraryDocsGenerationStatus";
DROP TYPE "LibraryDocsGenerationStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "library_docs_generations" DROP COLUMN "resultS3Key",
ADD COLUMN     "irS3Key" TEXT;
