import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

const releaseTypeSchema = z.enum(["GA", "RC"]);

const changelogEntryTypeSchema = z.enum(["fix", "feat", "chore", "break", "internal"]);

const changelogEntrySchema = z.object({
    type: changelogEntryTypeSchema,
    summary: z.string(),
    links: z.array(z.string()).optional(),
    upgradeNotes: z.string().optional(),
    added: z.array(z.string()).optional(),
    changed: z.array(z.string()).optional(),
    deprecated: z.array(z.string()).optional(),
    removed: z.array(z.string()).optional(),
    fixed: z.array(z.string()).optional()
});

const yankSchema = z.object({
    remediationVerision: z.string().optional()
});

const versionRangeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("inclusive"), value: z.string() }),
    z.object({ type: z.literal("exclusive"), value: z.string() })
]);

const cliReleaseSchema = z.object({
    version: z.string(),
    createdAt: z.string().optional(),
    isYanked: yankSchema.optional(),
    changelogEntry: z.array(changelogEntrySchema).optional(),
    releaseType: releaseTypeSchema,
    majorVersion: z.number(),
    irVersion: z.number(),
    tags: z.array(z.string()).optional()
});

const listCliReleasesResponseSchema = z.object({
    cliReleases: z.array(cliReleaseSchema)
});

export function createCliRouter(app: FdrApplication) {
    const getLatestCliRelease = os
        .route({ method: "POST", path: "/latest" })
        .input(
            z.object({
                releaseTypes: z.array(releaseTypeSchema).optional(),
                irVersion: z.number().optional()
            })
        )
        .output(cliReleaseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            const maybeLatestRelease = await app.dao.cliVersions().getLatestCliRelease({
                getLatestCliReleaseRequest: input
            });
            if (!maybeLatestRelease) {
                throw new ORPCError("NOT_FOUND");
            }
            return maybeLatestRelease;
        });

    const getChangelog = os
        .route({ method: "POST", path: "/changelog" })
        .input(
            z.object({
                fromVersion: versionRangeSchema,
                toVersion: versionRangeSchema
            })
        )
        .output(
            z.object({
                entries: z.array(
                    z.object({
                        version: z.string(),
                        changelogEntry: z.array(changelogEntrySchema)
                    })
                )
            })
        )
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            return await app.dao.cliVersions().getChangelog({
                versionRanges: input
            });
        });

    const getMinCliForIr = os
        .route({ method: "GET", path: "/for-ir/{irVersion}" })
        .input(
            z.object({
                irVersion: z.coerce.number()
            })
        )
        .output(cliReleaseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            const maybeRelease = await app.dao.cliVersions().getMinCliForIr({ irVersion: input.irVersion });
            if (!maybeRelease) {
                throw new ORPCError("NOT_FOUND");
            }
            return maybeRelease;
        });

    const upsertCliRelease = os
        .route({ method: "PUT", path: "/" })
        .input(
            z.object({
                version: z.string(),
                createdAt: z.string().optional(),
                isYanked: yankSchema.optional(),
                changelogEntry: z.array(changelogEntrySchema).optional(),
                irVersion: z.number(),
                tags: z.array(z.string()).optional()
            })
        )
        .output(z.void())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            await app.dao.cliVersions().upsertCliRelease({
                cliRelease: {
                    version: input.version,
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
                    irVersion: input.irVersion,
                    tags: input.tags
                }
            });
        });

    const getCliRelease = os
        .route({ method: "GET", path: "/{cliVersion}" })
        .input(
            z.object({
                cliVersion: z.string()
            })
        )
        .output(cliReleaseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            const maybeRelease = await app.dao.cliVersions().getCliRelease({ cliVersion: input.cliVersion });
            if (!maybeRelease) {
                throw new ORPCError("NOT_FOUND", {
                    data: { providedVersion: input.cliVersion }
                });
            }
            return maybeRelease;
        });

    const listCliReleases = os
        .route({ method: "GET", path: "/" })
        .input(
            z.object({
                page: z.coerce.number().optional(),
                pageSize: z.coerce.number().optional()
            })
        )
        .output(listCliReleasesResponseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            return await app.dao.cliVersions().listCliReleases({
                page: input.page,
                pageSize: input.pageSize
            });
        });

    return { getLatestCliRelease, getChangelog, getMinCliForIr, upsertCliRelease, getCliRelease, listCliReleases };
}
