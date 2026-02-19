import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import { GeneratorId } from "../../api/generated/api/resources/generators";
import type { FdrApplication } from "../../app";

const ChangelogEntryTypeSchema = z.enum(["fix", "feat", "chore", "break", "internal"]);

const ChangelogEntrySchema = z.object({
    type: ChangelogEntryTypeSchema,
    summary: z.string(),
    links: z.array(z.string()).optional(),
    upgradeNotes: z.string().optional(),
    added: z.array(z.string()).optional(),
    changed: z.array(z.string()).optional(),
    deprecated: z.array(z.string()).optional(),
    removed: z.array(z.string()).optional(),
    fixed: z.array(z.string()).optional()
});

const YankSchema = z.object({
    remediationVerision: z.string().optional()
});

const ReleaseTypeSchema = z.enum(["GA", "RC"]);

const VersionRangeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("inclusive"), value: z.string() }),
    z.object({ type: z.literal("exclusive"), value: z.string() })
]);

const GeneratorReleaseSchema = z.object({
    version: z.string(),
    createdAt: z.string().optional(),
    isYanked: YankSchema.optional(),
    changelogEntry: z.array(ChangelogEntrySchema).optional(),
    releaseType: ReleaseTypeSchema,
    majorVersion: z.number(),
    generatorId: z.string(),
    irVersion: z.number(),
    migration: z.string().optional(),
    customConfigSchema: z.string().optional(),
    tags: z.array(z.string()).optional()
});

const GeneratorReleaseRequestSchema = z.object({
    version: z.string(),
    createdAt: z.string().optional(),
    isYanked: YankSchema.optional(),
    changelogEntry: z.array(ChangelogEntrySchema).optional(),
    generatorId: z.string(),
    irVersion: z.number(),
    migration: z.string().optional(),
    customConfigSchema: z.string().optional(),
    tags: z.array(z.string()).optional()
});

export function createGeneratorVersionsRouter(app: FdrApplication) {
    const getLatestGeneratorRelease = os
        .route({ method: "POST", path: "/latest" })
        .input(
            z.object({
                generator: z.string(),
                cliVersion: z.string().optional(),
                irVersion: z.number().optional(),
                generatorMajorVersion: z.number().optional(),
                releaseTypes: z.array(ReleaseTypeSchema).optional()
            })
        )
        .output(GeneratorReleaseSchema)
        .handler(async ({ input }) => {
            const maybeLatestRelease = await app.dao.generatorVersions().getLatestGeneratorRelease({
                getLatestGeneratorReleaseRequest: {
                    ...input,
                    generator: GeneratorId(input.generator)
                }
            });
            if (!maybeLatestRelease) {
                throw new ORPCError("NOT_FOUND");
            }
            return maybeLatestRelease;
        });

    const getChangelog = os
        .route({ method: "POST", path: "/{org}/{name}/changelog" })
        .input(
            z.object({
                org: z.string(),
                name: z.string(),
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
            const generator = `${input.org}/${input.name}`;
            return await app.dao.generatorVersions().getChangelog({
                generator: GeneratorId(generator),
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
                    createdAt: input.createdAt,
                    isYanked:
                        input.isYanked != null
                            ? { remediationVerision: input.isYanked.remediationVerision }
                            : undefined,
                    changelogEntry: input.changelogEntry?.map((entry) => ({
                        type: entry.type,
                        summary: entry.summary,
                        links: entry.links,
                        upgradeNotes: entry.upgradeNotes,
                        added: entry.added,
                        changed: entry.changed,
                        deprecated: entry.deprecated,
                        removed: entry.removed,
                        fixed: entry.fixed
                    })),
                    migration: input.migration,
                    customConfigSchema: input.customConfigSchema,
                    tags: input.tags
                }
            });
        });

    const getGeneratorRelease = os
        .route({ method: "GET", path: "/{org}/{name}/{version}" })
        .input(
            z.object({
                org: z.string(),
                name: z.string(),
                version: z.string()
            })
        )
        .output(GeneratorReleaseSchema)
        .handler(async ({ input }) => {
            const generator = `${input.org}/${input.name}`;
            const maybeRelease = await app.dao.generatorVersions().getGeneratorRelease({
                generator: GeneratorId(generator),
                version: input.version
            });
            if (!maybeRelease) {
                throw new ORPCError("NOT_FOUND");
            }
            return maybeRelease;
        });

    const listGeneratorReleases = os
        .route({ method: "GET", path: "/{org}/{name}" })
        .input(
            z.object({
                org: z.string(),
                name: z.string(),
                page: z.coerce.number().optional(),
                pageSize: z.coerce.number().optional()
            })
        )
        .output(
            z.object({
                generatorReleases: z.array(GeneratorReleaseSchema)
            })
        )
        .handler(async ({ input }) => {
            const generator = `${input.org}/${input.name}`;
            return await app.dao.generatorVersions().listGeneratorReleases({
                generator: GeneratorId(generator),
                page: input.page,
                pageSize: input.pageSize
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
