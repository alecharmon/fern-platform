import { createEntitlementsChecker, createUsageProvider, type EntitlementsChecker } from "@fern-platform/entitlements";
import type { PrismaClient } from "@prisma/client";

export type { EntitlementsChecker };

export function createFdrEntitlementsChecker(prisma: PrismaClient): EntitlementsChecker {
    return createEntitlementsChecker({
        usageProvider: createUsageProvider({
            docs_sites: async (orgId: string) => {
                const result = await prisma.$queryRaw<{ count: bigint }[]>`
                    SELECT COUNT(DISTINCT "docsConfigInstanceId") as count
                    FROM "DocsV2"
                    WHERE "orgID" = ${orgId} AND "isPreview" = false AND "isArchived" = false
                `;
                return Number(result[0]?.count ?? 0);
            }
        })
    });
}
