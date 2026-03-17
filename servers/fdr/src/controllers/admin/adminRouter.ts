import { ORPCError, os } from "@orpc/server";
import * as z from "zod";
import type { FdrApplication } from "../../app";
import { getTokenFromAuthHeader, isSuperUser } from "../../services/auth/AuthService";

interface HandlerContext {
    headers: Record<string, string | undefined>;
}

function getAuthorization(context: object): string | undefined {
    return (context as HandlerContext).headers.authorization;
}

async function requireSuperUser(context: object): Promise<void> {
    const authHeader = getAuthorization(context);
    if (authHeader == null) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authorization header was not specified" });
    }
    const token = getTokenFromAuthHeader(authHeader);
    const superUser = await isSuperUser(token);
    if (!superUser) {
        throw new ORPCError("FORBIDDEN", { message: "Super-user permission required" });
    }
}

export function createAdminRouter(app: FdrApplication) {
    const listDocsSites = os
        .route({ method: "GET", path: "/docs-sites" })
        .input(
            z.custom<{
                limit?: string;
                offset?: string;
                orgIdFilter?: string;
            }>()
        )
        .output(
            z.custom<{
                sites: Array<{
                    id: string;
                    orgId: string;
                    domain: string;
                    basepath: string;
                    status: string;
                    createdAt: string;
                    updatedAt: string;
                }>;
                total: number;
            }>()
        )
        .handler(async ({ input, context }) => {
            await requireSuperUser(context);

            const limit = input.limit != null ? Math.max(1, Math.min(100, Math.trunc(Number(input.limit)))) : 50;
            const offset = input.offset != null ? Math.max(0, Math.trunc(Number(input.offset))) : 0;

            const result = await app.dao.docsSite().adminListAllDocsSites({
                limit,
                offset,
                orgIdFilter: input.orgIdFilter ?? undefined
            });

            return {
                sites: result.sites.map((s) => ({
                    id: s.id,
                    orgId: s.orgId,
                    domain: s.domain,
                    basepath: s.basepath,
                    status: s.status,
                    createdAt: s.createdAt.toISOString(),
                    updatedAt: s.updatedAt.toISOString()
                })),
                total: result.total
            };
        });

    const listDeployments = os
        .route({ method: "GET", path: "/deployments" })
        .input(
            z.custom<{
                domain: string;
                basepath?: string;
                limit?: string;
                offset?: string;
            }>()
        )
        .output(
            z.custom<{
                deployments: Array<{
                    id: string;
                    orgId: string;
                    domain: string;
                    basepath: string;
                    createdAt: string;
                    createdBy: string | undefined;
                    status: string;
                    updatedAt: string;
                    updatedBy: string | undefined;
                    previewUrl: string | undefined;
                    metadata: Record<string, unknown> | undefined;
                }>;
                total: number;
            }>()
        )
        .handler(async ({ input, context }) => {
            await requireSuperUser(context);

            const limit = input.limit != null ? Math.max(1, Math.min(100, Math.trunc(Number(input.limit)))) : 50;
            const offset = input.offset != null ? Math.max(0, Math.trunc(Number(input.offset))) : 0;

            const result = await app.dao.docsSite().adminListDeployments({
                domain: input.domain,
                basepath: input.basepath ?? undefined,
                limit,
                offset
            });

            return {
                deployments: result.deployments.map((d) => ({
                    id: d.id,
                    orgId: d.orgId,
                    domain: d.domain,
                    basepath: d.basepath,
                    createdAt: d.createdAt.toISOString(),
                    createdBy: d.createdBy ?? undefined,
                    status: d.status,
                    updatedAt: d.updatedAt.toISOString(),
                    updatedBy: d.updatedBy ?? undefined,
                    previewUrl: d.previewUrl ?? undefined,
                    metadata:
                        d.metadata != null && typeof d.metadata === "object" && !Array.isArray(d.metadata)
                            ? (d.metadata as Record<string, unknown>)
                            : undefined
                })),
                total: result.total
            };
        });

    const getOrgStats = os
        .route({ method: "GET", path: "/org-stats" })
        .input(
            z.custom<{
                limit?: string;
                offset?: string;
                orgIdFilter?: string;
                sortBy?: string;
                sortOrder?: string;
            }>()
        )
        .output(
            z.custom<{
                orgs: Array<{
                    orgId: string;
                    siteCount: number;
                    livePublishCount: number;
                    previewPublishCount: number;
                    lastPublishedAt: string | null;
                    sites: Array<{
                        domain: string;
                        basepath: string;
                        status: string;
                        updatedAt: string;
                    }>;
                }>;
                total: number;
            }>()
        )
        .handler(async ({ input, context }) => {
            await requireSuperUser(context);

            const limit = input.limit != null ? Math.max(1, Math.min(100, Math.trunc(Number(input.limit)))) : 50;
            const offset = input.offset != null ? Math.max(0, Math.trunc(Number(input.offset))) : 0;

            const validSortBy = ["livePublishes", "previewPublishes", "sites", "lastPublished"] as const;
            type SortBy = (typeof validSortBy)[number];
            const sortBy: SortBy = validSortBy.includes(input.sortBy as SortBy)
                ? (input.sortBy as SortBy)
                : "livePublishes";
            const sortOrder = input.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

            const result = await app.dao.docsSite().adminGetOrgStats({
                limit,
                offset,
                orgIdFilter: input.orgIdFilter ?? undefined,
                sortBy,
                sortOrder
            });

            return {
                orgs: result.orgs.map((o) => ({
                    orgId: o.orgId,
                    siteCount: o.siteCount,
                    livePublishCount: o.livePublishCount,
                    previewPublishCount: o.previewPublishCount,
                    lastPublishedAt: o.lastPublishedAt?.toISOString() ?? null,
                    sites: o.sites.map((s) => ({
                        domain: s.domain,
                        basepath: s.basepath,
                        status: s.status,
                        updatedAt: s.updatedAt.toISOString()
                    }))
                })),
                total: result.total
            };
        });

    const getSiteDetails = os
        .route({ method: "GET", path: "/site-details" })
        .input(
            z.custom<{
                limit?: string;
                offset?: string;
                orgIdFilter?: string;
            }>()
        )
        .output(
            z.custom<{
                sites: Array<{
                    id: string;
                    orgId: string;
                    domain: string;
                    basepath: string;
                    status: string;
                    createdAt: string;
                    updatedAt: string;
                    livePublishCount: number;
                    previewPublishCount: number;
                    lastDeploymentAt: string | null;
                    lastDeploymentStatus: string | null;
                }>;
                total: number;
            }>()
        )
        .handler(async ({ input, context }) => {
            await requireSuperUser(context);

            const limit = input.limit != null ? Math.max(1, Math.min(100, Math.trunc(Number(input.limit)))) : 50;
            const offset = input.offset != null ? Math.max(0, Math.trunc(Number(input.offset))) : 0;

            const result = await app.dao.docsSite().adminGetSiteDetails({
                limit,
                offset,
                orgIdFilter: input.orgIdFilter ?? undefined
            });

            return {
                sites: result.sites.map((s) => ({
                    id: s.id,
                    orgId: s.orgId,
                    domain: s.domain,
                    basepath: s.basepath,
                    status: s.status,
                    createdAt: s.createdAt.toISOString(),
                    updatedAt: s.updatedAt.toISOString(),
                    livePublishCount: s.livePublishCount,
                    previewPublishCount: s.previewPublishCount,
                    lastDeploymentAt: s.lastDeploymentAt?.toISOString() ?? null,
                    lastDeploymentStatus: s.lastDeploymentStatus ?? null
                })),
                total: result.total
            };
        });

    return { listDocsSites, listDeployments, getOrgStats, getSiteDetails };
}
