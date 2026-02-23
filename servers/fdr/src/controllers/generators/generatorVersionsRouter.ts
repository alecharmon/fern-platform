import {
    ChangelogEntrySchema,
    GeneratorId,
    GeneratorReleaseRequestSchema,
    GeneratorReleaseSchema,
    ReleaseTypeSchema,
    VersionRangeSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";
import type { FdrApplication } from "../../app";

export function createGeneratorVersionsRouter(app: FdrApplication) {
    const getLatestGeneratorRelease = os
        .route({ method: "POST", path: "/latest" })
        .input(
            z.object({
                generator: z.string(),
                cliVersion: z.string().nullish(),
                irVersion: z.number().nullish(),
                generatorMajorVersion: z.number().nullish(),
                releaseTypes: z.array(ReleaseTypeSchema).nullish()
            })
        )
        .output(GeneratorReleaseSchema)
        .handler(async ({ input }) => {
            const maybeLatestRelease = await app.dao.generatorVersions().getLatestGeneratorRelease({
                getLatestGeneratorReleaseRequest: {
                    generator: GeneratorId(input.generator),
                    cliVersion: input.cliVersion ?? undefined,
                    irVersion: input.irVersion ?? undefined,
                    generatorMajorVersion: input.generatorMajorVersion ?? undefined,
                    releaseTypes: input.releaseTypes ?? undefined
                }
            });
            if (!maybeLatestRelease) {
                throw new ORPCError("NOT_FOUND");
            }
            return maybeLatestRelease;
        });

    const getChangelog = os
        .route({ method: "POST", path: "/{generator}/changelog" })
        .input(
            z.object({
                generator: z.string(),
                fromVersion: VersionRangeSchema,
                toVersion: VersionRangeSchema
            })
        )
        .output(
            z.object({
                entries: z.array(
                    z.object({
                        version: z.string(),
                        changelogEntry: z.array(ChangelogEntrySchema)
                    })
                )
            })
        )
        .handler(async ({ input }) => {
            return await app.dao.generatorVersions().getChangelog({
                generator: GeneratorId(input.generator),
                versionRanges: {
                    fromVersion: input.fromVersion,
                    toVersion: input.toVersion
                }
            });
        });

    const upsertGeneratorRelease = os
        .route({ method: "PUT", path: "/" })
        .input(GeneratorReleaseRequestSchema)
        .output(z.void())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            await app.dao.generatorVersions().upsertGeneratorRelease({
                generatorRelease: {
                    version: input.version,
                    generatorId: GeneratorId(input.generatorId),
                    irVersion: input.irVersion,
                    createdAt: input.createdAt ?? undefined,
                    isYanked:
                        input.isYanked != null
                            ? { remediationVerision: input.isYanked.remediationVerision ?? undefined }
                            : undefined,
                    changelogEntry: input.changelogEntry?.map((entry) => ({
                        type: entry.type,
                        summary: entry.summary,
                        links: entry.links ?? undefined,
                        upgradeNotes: entry.upgradeNotes ?? undefined,
                        added: entry.added ?? undefined,
                        changed: entry.changed ?? undefined,
                        deprecated: entry.deprecated ?? undefined,
                        removed: entry.removed ?? undefined,
                        fixed: entry.fixed ?? undefined
                    })),
                    migration: input.migration ?? undefined,
                    customConfigSchema: input.customConfigSchema ?? undefined,
                    tags: input.tags ?? undefined
                }
            });
        });

    const getGeneratorRelease = os
        .route({ method: "GET", path: "/{generator}/{version}" })
        .input(
            z.object({
                generator: z.string(),
                version: z.string()
            })
        )
        .output(GeneratorReleaseSchema)
        .handler(async ({ input }) => {
            const maybeRelease = await app.dao.generatorVersions().getGeneratorRelease({
                generator: GeneratorId(input.generator),
                version: input.version
            });
            if (!maybeRelease) {
                throw new ORPCError("NOT_FOUND");
            }
            return maybeRelease;
        });

    const listGeneratorReleases = os
        .route({ method: "GET", path: "/{generator}" })
        .input(
            z.object({
                generator: z.string(),
                page: z.coerce.number().nullish(),
                pageSize: z.coerce.number().nullish()
            })
        )
        .output(
            z.object({
                generatorReleases: z.array(GeneratorReleaseSchema)
            })
        )
        .handler(async ({ input }) => {
            return await app.dao.generatorVersions().listGeneratorReleases({
                generator: GeneratorId(input.generator),
                page: input.page ?? undefined,
                pageSize: input.pageSize ?? undefined
            });
        });

    return {
        getLatestGeneratorRelease,
        getChangelog,
        upsertGeneratorRelease,
        getGeneratorRelease,
        listGeneratorReleases
    };
}
