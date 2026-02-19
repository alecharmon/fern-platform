import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

const releaseTypeSchema = z.enum(["GA", "RC"]);

const changelogEntryTypeSchema = z.enum(["fix", "feat", "chore", "break", "internal"]);

const changelogEntrySchema = z.object({
    type: changelogEntryTypeSchema,
    summary: z.string(),
    links: z.array(z.string()).nullish(),
    upgradeNotes: z.string().nullish(),
    added: z.array(z.string()).nullish(),
    changed: z.array(z.string()).nullish(),
    deprecated: z.array(z.string()).nullish(),
    removed: z.array(z.string()).nullish(),
    fixed: z.array(z.string()).nullish()
});

const yankSchema = z.object({
    remediationVerision: z.string().nullish()
});

const versionRangeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("inclusive"), value: z.string() }),
    z.object({ type: z.literal("exclusive"), value: z.string() })
]);

const cliReleaseSchema = z.object({
    version: z.string(),
    createdAt: z.string().nullish(),
    isYanked: yankSchema.nullish(),
    changelogEntry: z.array(changelogEntrySchema).nullish(),
    releaseType: releaseTypeSchema,
    majorVersion: z.number(),
    irVersion: z.number(),
    tags: z.array(z.string()).nullish()
});

const listCliReleasesResponseSchema = z.object({
    cliReleases: z.array(cliReleaseSchema)
});

export function createCliRouter(app: FdrApplication) {
    const getLatestCliRelease = os
        .route({ method: "POST", path: "/latest" })
        .input(
            z.object({
                releaseTypes: z.array(releaseTypeSchema).nullish(),
                irVersion: z.number().nullish()
            })
        )
        .output(cliReleaseSchema)
        .handler(async ({ input }) => {
            const maybeLatestRelease = await app.dao.cliVersions().getLatestCliRelease({
                getLatestCliReleaseRequest: {
                    releaseTypes: input.releaseTypes ?? undefined,
                    irVersion: input.irVersion ?? undefined
                }
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
        .handler(async ({ input }) => {
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
        .handler(async ({ input }) => {
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
                createdAt: z.string().nullish(),
                isYanked: yankSchema.nullish(),
                changelogEntry: z.array(changelogEntrySchema).nullish(),
                irVersion: z.number(),
                tags: z.array(z.string()).nullish()
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
                    irVersion: input.irVersion,
                    tags: input.tags ?? undefined
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
        .handler(async ({ input }) => {
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
                page: z.coerce.number().nullish(),
                pageSize: z.coerce.number().nullish()
            })
        )
        .output(listCliReleasesResponseSchema)
        .handler(async ({ input }) => {
            return await app.dao.cliVersions().listCliReleases({
                page: input.page ?? undefined,
                pageSize: input.pageSize ?? undefined
            });
        });

    return { getLatestCliRelease, getChangelog, getMinCliForIr, upsertCliRelease, getCliRelease, listCliReleases };
}
