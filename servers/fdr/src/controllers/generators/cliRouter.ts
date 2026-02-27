import type {
    CliReleaseSchema,
    GetChangelogResponseSchema,
    ListCliReleasesResponseSchema,
    ReleaseTypeSchema,
    UpsertCliReleaseInputSchema,
    VersionRangeSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

export function createCliRouter(app: FdrApplication) {
    const getLatestCliRelease = os
        .route({ method: "POST", path: "/latest" })
        .input(
            z.custom<{
                releaseTypes: z.infer<typeof ReleaseTypeSchema>[] | null | undefined;
                irVersion: number | null | undefined;
            }>()
        )
        .output(z.custom<z.infer<typeof CliReleaseSchema>>())
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
            z.custom<{
                fromVersion: z.infer<typeof VersionRangeSchema>;
                toVersion: z.infer<typeof VersionRangeSchema>;
            }>()
        )
        .output(z.custom<z.infer<typeof GetChangelogResponseSchema>>())
        .handler(async ({ input }) => {
            return await app.dao.cliVersions().getChangelog({
                versionRanges: input
            });
        });

    const getMinCliForIr = os
        .route({ method: "GET", path: "/for-ir/{irVersion}" })
        .input(z.custom<{ irVersion: string | number }>())
        .output(z.custom<z.infer<typeof CliReleaseSchema>>())
        .handler(async ({ input }) => {
            const maybeRelease = await app.dao.cliVersions().getMinCliForIr({ irVersion: Number(input.irVersion) });
            if (!maybeRelease) {
                throw new ORPCError("NOT_FOUND");
            }
            return maybeRelease;
        });

    const upsertCliRelease = os
        .route({ method: "PUT", path: "/" })
        .input(z.custom<z.infer<typeof UpsertCliReleaseInputSchema>>())
        .output(z.custom<void>())
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
        .input(z.custom<{ cliVersion: string }>())
        .output(z.custom<z.infer<typeof CliReleaseSchema>>())
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
        .input(z.custom<{ page: string | number | null | undefined; pageSize: string | number | null | undefined }>())
        .output(z.custom<z.infer<typeof ListCliReleasesResponseSchema>>())
        .handler(async ({ input }) => {
            return await app.dao.cliVersions().listCliReleases({
                page: input.page != null ? Number(input.page) : undefined,
                pageSize: input.pageSize != null ? Number(input.pageSize) : undefined
            });
        });

    return { getLatestCliRelease, getChangelog, getMinCliForIr, upsertCliRelease, getCliRelease, listCliReleases };
}
