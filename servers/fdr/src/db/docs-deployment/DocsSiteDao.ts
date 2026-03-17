import type { DocsDeployment, DocsDeploymentStatus, DocsSite, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

export interface RegisterDocsSiteParams {
    domain: string;
    orgId: string;
    basepath?: string;
    previewUrl?: string;
    postmanCollectionId?: string;
}

export interface CreateDeploymentParams {
    domain: string;
    orgId: string;
    userId?: string;
    basepath?: string;
    previewUrl?: string;
    metadata?: Prisma.InputJsonValue;
}

export interface ListDocsDeploymentsParams {
    domain: string;
    orgId: string;
    basepath?: string;
    limit?: number;
}

export interface AdminListDocsSitesParams {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
}

export interface AdminListDeploymentsParams {
    domain: string;
    basepath?: string;
    limit?: number;
    offset?: number;
}

export interface AdminOrgStats {
    orgId: string;
    siteCount: number;
    livePublishCount: number;
    previewPublishCount: number;
    lastPublishedAt: Date | null;
    sites: Array<{
        domain: string;
        basepath: string;
        status: string;
        updatedAt: Date;
    }>;
}

export interface AdminListOrgStatsParams {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
    sortBy?: "livePublishes" | "previewPublishes" | "sites" | "lastPublished";
    sortOrder?: "asc" | "desc";
}

export interface AdminSiteDetails {
    id: string;
    orgId: string;
    domain: string;
    basepath: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    livePublishCount: number;
    previewPublishCount: number;
    lastDeploymentAt: Date | null;
    lastDeploymentStatus: string | null;
}

export interface DocsSiteDao {
    registerDocsSite(params: RegisterDocsSiteParams): Promise<DocsSite>;
    getDocsStatus(domain: string, basepath?: string): Promise<DocsDeploymentStatus | null>;
    getPostmanCollectionId(orgId: string, domain: string, basepath?: string): Promise<string | null>;
    setDocsStatus(
        domain: string,
        orgId: string,
        basepath: string | undefined,
        status: DocsDeploymentStatus
    ): Promise<DocsSite>;
    createDeployment(params: CreateDeploymentParams): Promise<string>;
    updateDeploymentStatus(deploymentId: string, status: DocsDeploymentStatus, updatedBy?: string): Promise<void>;
    getDeploymentOrgId(deploymentId: string): Promise<string | null>;
    getDocsDeployments(params: ListDocsDeploymentsParams): Promise<DocsDeployment[]>;
    getLatestPublishingDeployment(domain: string, basepath?: string): Promise<DocsDeployment | null>;
    getDocsSitesForOrg(orgId: string): Promise<DocsSite[]>;
    adminListAllDocsSites(params: AdminListDocsSitesParams): Promise<{ sites: DocsSite[]; total: number }>;
    adminListDeployments(params: AdminListDeploymentsParams): Promise<{ deployments: DocsDeployment[]; total: number }>;
    adminGetOrgStats(params: AdminListOrgStatsParams): Promise<{ orgs: AdminOrgStats[]; total: number }>;
    adminGetSiteDetails(params: AdminListDocsSitesParams): Promise<{ sites: AdminSiteDetails[]; total: number }>;
}

export class DocsSiteDaoImpl implements DocsSiteDao {
    constructor(private readonly prisma: PrismaClient) {}

    public async registerDocsSite(params: RegisterDocsSiteParams): Promise<DocsSite> {
        const id = `docs_site_${uuidv4()}`;
        return this.prisma.docsSite.upsert({
            where: {
                orgId_domain_basepath: {
                    orgId: params.orgId,
                    domain: params.domain,
                    // fallback to "" because basepath is non-nullable in the compound unique index
                    basepath: params.basepath ?? ""
                }
            },
            create: {
                id,
                orgId: params.orgId,
                domain: params.domain,
                basepath: params.basepath ?? "",
                previewUrl: params.previewUrl,
                postmanCollectionId: params.postmanCollectionId,
                status: "PUBLISHING"
            },
            update: {
                previewUrl: params.previewUrl,
                // Only update postmanCollectionId if explicitly provided;
                // otherwise preserve the existing value (e.g. during CLI re-publishes)
                ...(params.postmanCollectionId != null ? { postmanCollectionId: params.postmanCollectionId } : {}),
                status: "PUBLISHING"
            }
        });
    }

    public async getDocsStatus(domain: string, basepath?: string): Promise<DocsDeploymentStatus | null> {
        const site = await this.prisma.docsSite.findFirst({
            where: {
                domain,
                basepath: basepath ?? ""
            },
            select: {
                status: true
            }
        });

        if (site == null) {
            return null;
        }

        return site.status;
    }

    public async getPostmanCollectionId(orgId: string, domain: string, basepath?: string): Promise<string | null> {
        const site = await this.prisma.docsSite.findUnique({
            where: {
                orgId_domain_basepath: {
                    orgId,
                    domain,
                    basepath: basepath ?? ""
                }
            },
            select: {
                postmanCollectionId: true
            }
        });

        return site?.postmanCollectionId ?? null;
    }

    public async setDocsStatus(
        domain: string,
        orgId: string,
        basepath: string | undefined,
        status: DocsDeploymentStatus
    ): Promise<DocsSite> {
        const id = `docs_site_${uuidv4()}`;
        return this.prisma.docsSite.upsert({
            where: {
                orgId_domain_basepath: {
                    orgId,
                    domain,
                    basepath: basepath ?? ""
                }
            },
            create: {
                id,
                orgId,
                domain,
                basepath: basepath ?? "",
                status
            },
            update: {
                status
            }
        });
    }

    public async createDeployment(params: CreateDeploymentParams): Promise<string> {
        const deploymentId = `deploy_${uuidv4()}`;
        await this.prisma.docsDeployment.create({
            data: {
                id: deploymentId,
                orgId: params.orgId,
                domain: params.domain,
                basepath: params.basepath ?? "",
                createdBy: params.userId,
                status: "PUBLISHING",
                previewUrl: params.previewUrl,
                metadata: params.metadata
            }
        });
        return deploymentId;
    }

    public async updateDeploymentStatus(
        deploymentId: string,
        status: DocsDeploymentStatus,
        updatedBy?: string
    ): Promise<void> {
        await this.prisma.docsDeployment.update({
            where: { id: deploymentId },
            data: {
                status,
                updatedBy
            }
        });
    }

    public async getDeploymentOrgId(deploymentId: string): Promise<string | null> {
        const deployment = await this.prisma.docsDeployment.findUnique({
            where: { id: deploymentId },
            select: { orgId: true }
        });
        return deployment?.orgId ?? null;
    }

    public async getDocsDeployments(params: ListDocsDeploymentsParams): Promise<DocsDeployment[]> {
        return this.prisma.docsDeployment.findMany({
            where: {
                domain: params.domain,
                orgId: params.orgId,
                basepath: params.basepath ?? ""
            },
            orderBy: {
                createdAt: "desc"
            },
            take: params.limit ?? 100
        });
    }

    public async getLatestPublishingDeployment(domain: string, basepath?: string): Promise<DocsDeployment | null> {
        return this.prisma.docsDeployment.findFirst({
            where: {
                domain,
                basepath: basepath ?? "",
                status: "PUBLISHING"
            },
            orderBy: {
                createdAt: "desc"
            }
        });
    }

    public async getDocsSitesForOrg(orgId: string): Promise<DocsSite[]> {
        return this.prisma.docsSite.findMany({
            where: {
                orgId,
                previewUrl: null
            },
            orderBy: {
                createdAt: "desc"
            }
        });
    }

    public async adminListAllDocsSites(
        params: AdminListDocsSitesParams
    ): Promise<{ sites: DocsSite[]; total: number }> {
        const where: Prisma.DocsSiteWhereInput = {
            previewUrl: null,
            ...(params.orgIdFilter ? { orgId: { contains: params.orgIdFilter, mode: "insensitive" as const } } : {})
        };

        const [sites, total] = await this.prisma.$transaction([
            this.prisma.docsSite.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                take: params.limit ?? 50,
                skip: params.offset ?? 0
            }),
            this.prisma.docsSite.count({ where })
        ]);

        return { sites, total };
    }

    public async adminListDeployments(
        params: AdminListDeploymentsParams
    ): Promise<{ deployments: DocsDeployment[]; total: number }> {
        const where: Prisma.DocsDeploymentWhereInput = {
            domain: params.domain,
            basepath: params.basepath ?? ""
        };

        const [deployments, total] = await this.prisma.$transaction([
            this.prisma.docsDeployment.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: params.limit ?? 50,
                skip: params.offset ?? 0
            }),
            this.prisma.docsDeployment.count({ where })
        ]);

        return { deployments, total };
    }

    public async adminGetOrgStats(params: AdminListOrgStatsParams): Promise<{ orgs: AdminOrgStats[]; total: number }> {
        const orgFilter = params.orgIdFilter
            ? Prisma.sql`AND s."orgId" ILIKE ${"%" + params.orgIdFilter + "%"}`
            : Prisma.empty;

        const sortColumn = {
            livePublishes: Prisma.sql`"livePublishCount"`,
            previewPublishes: Prisma.sql`"previewPublishCount"`,
            sites: Prisma.sql`"siteCount"`,
            lastPublished: Prisma.sql`"lastPublishedAt"`
        }[params.sortBy ?? "livePublishes"];

        const sortDir = params.sortOrder === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

        const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT s."orgId")::bigint as count
            FROM docs_sites s
            WHERE s."previewUrl" IS NULL ${orgFilter}
        `;
        const total = Number(countResult[0]?.count ?? 0);

        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;

        const orgRows = await this.prisma.$queryRaw<
            Array<{
                orgId: string;
                siteCount: bigint;
                livePublishCount: bigint;
                previewPublishCount: bigint;
                lastPublishedAt: Date | null;
            }>
        >`
            SELECT
                s."orgId",
                COUNT(DISTINCT CONCAT(s.domain, ':', s.basepath))::bigint AS "siteCount",
                COALESCE((
                    SELECT COUNT(*)::bigint FROM docs_deployments d
                    WHERE d."orgId" = s."orgId" AND d."previewUrl" IS NULL AND d.status = 'LIVE'
                ), 0) AS "livePublishCount",
                COALESCE((
                    SELECT COUNT(*)::bigint FROM docs_deployments d
                    WHERE d."orgId" = s."orgId" AND d."previewUrl" IS NOT NULL
                ), 0) AS "previewPublishCount",
                (
                    SELECT MAX(d."createdAt") FROM docs_deployments d
                    WHERE d."orgId" = s."orgId" AND d."previewUrl" IS NULL
                ) AS "lastPublishedAt"
            FROM docs_sites s
            WHERE s."previewUrl" IS NULL ${orgFilter}
            GROUP BY s."orgId"
            ORDER BY ${sortColumn} ${sortDir} NULLS LAST
            LIMIT ${limit} OFFSET ${offset}
        `;

        const orgs: AdminOrgStats[] = [];
        for (const row of orgRows) {
            const sites = await this.prisma.docsSite.findMany({
                where: { orgId: row.orgId, previewUrl: null },
                select: { domain: true, basepath: true, status: true, updatedAt: true },
                orderBy: { updatedAt: "desc" }
            });

            orgs.push({
                orgId: row.orgId,
                siteCount: Number(row.siteCount),
                livePublishCount: Number(row.livePublishCount),
                previewPublishCount: Number(row.previewPublishCount),
                lastPublishedAt: row.lastPublishedAt,
                sites: sites.map((s) => ({
                    domain: s.domain,
                    basepath: s.basepath,
                    status: s.status,
                    updatedAt: s.updatedAt
                }))
            });
        }

        return { orgs, total };
    }

    public async adminGetSiteDetails(
        params: AdminListDocsSitesParams
    ): Promise<{ sites: AdminSiteDetails[]; total: number }> {
        const where: Prisma.DocsSiteWhereInput = {
            previewUrl: null,
            ...(params.orgIdFilter ? { orgId: { contains: params.orgIdFilter, mode: "insensitive" as const } } : {})
        };

        const [rawSites, total] = await this.prisma.$transaction([
            this.prisma.docsSite.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                take: params.limit ?? 50,
                skip: params.offset ?? 0
            }),
            this.prisma.docsSite.count({ where })
        ]);

        const sites: AdminSiteDetails[] = [];
        for (const site of rawSites) {
            const [liveCount, previewCount, lastDeploy] = await this.prisma.$transaction([
                this.prisma.docsDeployment.count({
                    where: { domain: site.domain, basepath: site.basepath, previewUrl: null, status: "LIVE" }
                }),
                this.prisma.docsDeployment.count({
                    where: { domain: site.domain, basepath: site.basepath, previewUrl: { not: null } }
                }),
                this.prisma.docsDeployment.findFirst({
                    where: { domain: site.domain, basepath: site.basepath },
                    orderBy: { createdAt: "desc" },
                    select: { createdAt: true, status: true }
                })
            ]);

            sites.push({
                id: site.id,
                orgId: site.orgId,
                domain: site.domain,
                basepath: site.basepath,
                status: site.status,
                createdAt: site.createdAt,
                updatedAt: site.updatedAt,
                livePublishCount: liveCount,
                previewPublishCount: previewCount,
                lastDeploymentAt: lastDeploy?.createdAt ?? null,
                lastDeploymentStatus: lastDeploy?.status ?? null
            });
        }

        return { sites, total };
    }
}
