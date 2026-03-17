import type {
    AdminAiSettings,
    AdminDeploymentsResponse,
    AdminDocsSitesResponse,
    AdminOrgStatsResponse,
    AdminReindexingJob,
    AdminSiteDetailsResponse
} from "./getAdminData";

const MOCK_ORGS = [
    "acme-corp",
    "plantstore",
    "buildwithfern",
    "petstore-api",
    "greenhouse-io",
    "leafy-sdk",
    "rootsystem",
    "botanica-labs",
    "floranet",
    "seedling-dev"
];

const MOCK_DOMAINS = [
    "docs.acme-corp.com",
    "docs.plantstore.dev",
    "buildwithfern.com",
    "api.petstore.io",
    "docs.greenhouse-io.com",
    "leafy-sdk.dev",
    "docs.rootsystem.io",
    "botanica-labs.com",
    "api.floranet.dev",
    "docs.seedling-dev.com"
];

const STATUSES = ["LIVE", "LIVE", "LIVE", "LIVE", "PUBLISHING", "UNPUBLISHED", "ERROR"];

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): string {
    const d = new Date();
    d.setDate(d.getDate() - randomInt(0, daysBack));
    return d.toISOString();
}

function randomStatus(): string {
    return STATUSES[randomInt(0, STATUSES.length - 1)] ?? "LIVE";
}

export function getMockOrgStats(params: {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
    sortBy?: string;
    sortOrder?: string;
}): AdminOrgStatsResponse {
    let orgs = MOCK_ORGS.map((orgId, i) => ({
        orgId,
        siteCount: randomInt(1, 5),
        livePublishCount: 200 - i * 18 + randomInt(-5, 5),
        previewPublishCount: randomInt(5, 80),
        lastPublishedAt: randomDate(30),
        sites: [
            {
                domain: MOCK_DOMAINS[i] ?? `docs.${orgId}.com`,
                basepath: "",
                status: randomStatus(),
                updatedAt: randomDate(10)
            },
            ...(randomInt(0, 1)
                ? [
                      {
                          domain: `staging.${orgId}.com`,
                          basepath: "/v2",
                          status: "PUBLISHING" as const,
                          updatedAt: randomDate(5)
                      }
                  ]
                : [])
        ]
    }));

    if (params.orgIdFilter) {
        const filter = params.orgIdFilter.toLowerCase();
        orgs = orgs.filter((o) => o.orgId.toLowerCase().includes(filter));
    }

    const total = orgs.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    return { orgs: orgs.slice(offset, offset + limit), total };
}

export function getMockSiteDetails(params: {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
}): AdminSiteDetailsResponse {
    let sites = MOCK_ORGS.flatMap((orgId, i) => [
        {
            id: `site-${i}-a`,
            orgId,
            domain: MOCK_DOMAINS[i] ?? `docs.${orgId}.com`,
            basepath: "",
            status: randomStatus(),
            createdAt: randomDate(365),
            updatedAt: randomDate(30),
            livePublishCount: randomInt(10, 200),
            previewPublishCount: randomInt(0, 50),
            lastDeploymentAt: randomDate(7),
            lastDeploymentStatus: randomStatus()
        }
    ]);

    if (params.orgIdFilter) {
        const filter = params.orgIdFilter.toLowerCase();
        sites = sites.filter((s) => s.orgId.toLowerCase().includes(filter) || s.domain.toLowerCase().includes(filter));
    }

    const total = sites.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    return { sites: sites.slice(offset, offset + limit), total };
}

export function getMockDocsSites(params: {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
}): AdminDocsSitesResponse {
    let sites = MOCK_ORGS.map((orgId, i) => ({
        id: `site-${i}`,
        orgId,
        domain: MOCK_DOMAINS[i] ?? `docs.${orgId}.com`,
        basepath: "",
        status: randomStatus(),
        createdAt: randomDate(365),
        updatedAt: randomDate(30)
    }));

    if (params.orgIdFilter) {
        const filter = params.orgIdFilter.toLowerCase();
        sites = sites.filter((s) => s.orgId.toLowerCase().includes(filter));
    }

    const total = sites.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    return { sites: sites.slice(offset, offset + limit), total };
}

export function getMockDeployments(params: {
    domain: string;
    limit?: number;
    offset?: number;
}): AdminDeploymentsResponse {
    const deployments = Array.from({ length: 15 }, (_, i) => ({
        id: `deploy-${i}`,
        orgId: "acme-corp",
        domain: params.domain,
        basepath: "",
        createdAt: randomDate(60),
        createdBy: i % 3 === 0 ? "user@fern.dev" : undefined,
        status: i === 0 ? "LIVE" : randomStatus(),
        updatedAt: randomDate(60),
        updatedBy: undefined,
        previewUrl: i % 2 === 0 ? `https://preview-${i}.fern.dev` : undefined,
        metadata: undefined
    }));

    const total = deployments.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    return { deployments: deployments.slice(offset, offset + limit), total };
}

const JOB_STATUSES = ["completed", "completed", "completed", "failed", "queued", "batching", "syncing", "oom_retry"];

export function getMockReindexingJobs(params: {
    limit?: number;
    offset?: number;
    domainFilter?: string;
    statusFilter?: string;
}): { jobs: AdminReindexingJob[]; total: number } {
    let jobs: AdminReindexingJob[] = MOCK_DOMAINS.flatMap((domain, i) =>
        Array.from({ length: 3 }, (_, j) => {
            const status = JOB_STATUSES[randomInt(0, JOB_STATUSES.length - 1)] ?? "COMPLETED";
            const created = randomDate(14);
            const started = randomDate(14);
            const durationMs = status === "COMPLETED" ? randomInt(5000, 120000) : null;
            return {
                id: `job-${i}-${j}`,
                domain,
                basepath: j === 0 ? null : `/v${j}`,
                force_full_reindex: j % 3 === 0,
                status,
                started_at: started,
                completed_at:
                    status === "COMPLETED"
                        ? new Date(new Date(started).getTime() + (durationMs ?? 0)).toISOString()
                        : null,
                created_at: created,
                updated_at: started,
                job_total_time_ms: durationMs,
                num_inserted: status === "COMPLETED" ? randomInt(50, 5000) : null,
                num_deleted: status === "COMPLETED" ? randomInt(0, 500) : null,
                error: status === "FAILED" ? "OOM: exceeded memory limit" : null,
                reason: status === "FAILED" ? "memory_limit_exceeded" : null,
                memory_mb: randomInt(128, 2048),
                retry_count: status === "OOM_RETRY" ? randomInt(1, 3) : 0
            };
        })
    );

    if (params.domainFilter) {
        const filter = params.domainFilter.toLowerCase();
        jobs = jobs.filter((j) => j.domain.toLowerCase().includes(filter));
    }
    if (params.statusFilter) {
        jobs = jobs.filter((j) => j.status === params.statusFilter);
    }

    const total = jobs.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    return { jobs: jobs.slice(offset, offset + limit), total };
}

export function getMockAiSettings(params: { limit?: number; offset?: number; domainFilter?: string }): {
    settings: AdminAiSettings[];
    total: number;
} {
    let settings: AdminAiSettings[] = MOCK_DOMAINS.map((domain, i) => ({
        domain,
        basepath: "",
        last_reindex_time: randomDate(7),
        docs_enabled: i % 2 === 0,
        slack_enabled: i % 3 === 0,
        discord_enabled: i % 5 === 0,
        is_preview: i % 4 === 0,
        decompose_queries: i % 3 === 0,
        org_name: MOCK_ORGS[i] ?? null
    }));

    if (params.domainFilter) {
        const filter = params.domainFilter.toLowerCase();
        settings = settings.filter((s) => s.domain.toLowerCase().includes(filter));
    }

    const total = settings.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    return { settings: settings.slice(offset, offset + limit), total };
}
