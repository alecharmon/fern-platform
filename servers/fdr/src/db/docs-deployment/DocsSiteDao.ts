import type { DocsDeployment, DocsDeploymentStatus, DocsSite, Prisma, PrismaClient } from "@prisma/client";
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
    cursor?: Date;
    excludeInternalUsers?: boolean;
    isPreview?: boolean;
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
    unlockPublishingDeployments(domain: string, basepath?: string): Promise<number>;
    getDocsSitesForOrg(orgId: string): Promise<DocsSite[]>;
    deleteDocsSite(params: { orgId: string; domain: string; basepath?: string }): Promise<void>;
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
                basepath: params.basepath ?? "",
                ...(params.cursor != null ? { createdAt: { lt: params.cursor } } : {}),
                ...(params.excludeInternalUsers === true
                    ? { NOT: { createdBy: { endsWith: "@buildwithfern.com" } } }
                    : {}),
                ...(params.isPreview === true
                    ? { previewUrl: { not: null } }
                    : params.isPreview === false
                      ? { OR: [{ previewUrl: null }, { previewUrl: "" }] }
                      : {})
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

    public async unlockPublishingDeployments(domain: string, basepath?: string): Promise<number> {
        const result = await this.prisma.docsDeployment.updateMany({
            where: {
                domain,
                basepath: basepath ?? "",
                status: "PUBLISHING"
            },
            data: {
                status: "ERROR"
            }
        });
        return result.count;
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

    public async deleteDocsSite(params: { orgId: string; domain: string; basepath?: string }): Promise<void> {
        await this.prisma.docsSite.deleteMany({
            where: {
                orgId: params.orgId,
                domain: params.domain,
                basepath: params.basepath ?? ""
            }
        });
    }
}
