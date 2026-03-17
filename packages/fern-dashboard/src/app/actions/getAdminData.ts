"use server";

import {
    getMockAiSettings,
    getMockDeployments,
    getMockDocsSites,
    getMockOrgStats,
    getMockReindexingJobs,
    getMockSiteDetails
} from "./adminMockData";

const USE_MOCK = process.env.MOCK_ADMIN_DATA === "true";

// --- Types ---

export interface AdminDocsSite {
    id: string;
    orgId: string;
    domain: string;
    basepath: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminDocsSitesResponse {
    sites: AdminDocsSite[];
    total: number;
}

export interface AdminDeployment {
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
}

export interface AdminDeploymentsResponse {
    deployments: AdminDeployment[];
    total: number;
}

export interface AdminOrgStat {
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
}

export interface AdminOrgStatsResponse {
    orgs: AdminOrgStat[];
    total: number;
}

export interface AdminSiteDetail {
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
}

export interface AdminSiteDetailsResponse {
    sites: AdminSiteDetail[];
    total: number;
}

export interface AdminReindexingJob {
    id: string;
    domain: string;
    basepath: string | null;
    force_full_reindex: boolean;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    job_total_time_ms: number | null;
    num_inserted: number | null;
    num_deleted: number | null;
    error: string | null;
    reason: string | null;
    memory_mb: number | null;
    retry_count: number;
}

export interface AdminAiSettings {
    domain: string;
    basepath: string;
    last_reindex_time: string | null;
    docs_enabled: boolean;
    slack_enabled: boolean;
    discord_enabled: boolean;
    is_preview: boolean;
    decompose_queries: boolean;
    org_name: string | null;
}

// --- FDR Admin API helpers (lazy-loaded so mock mode has zero external dependencies) ---

function getAdminFdrBaseUrl(): string {
    const url = process.env.FDR_SERVER_URL;
    if (url == null) {
        throw new Error("FDR_SERVER_URL is not defined in the current environment");
    }
    return url;
}

async function adminFetch<T>(path: string, token: string): Promise<T> {
    const baseUrl = getAdminFdrBaseUrl();
    const response = await fetch(`${baseUrl}/admin${path}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Admin API error (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
}

async function requireSuperUserSession() {
    const { getCurrentSessionOrThrow } = await import("@/app/services/auth0/getCurrentSession");
    const { isSuperUser } = await import("@fern-api/user-permissions");
    const session = await getCurrentSessionOrThrow();
    if (!isSuperUser(session.permissions ?? [])) {
        throw new Error("Unauthorized: super-user permission required");
    }
    return session;
}

// --- FDR endpoints ---

export async function getAdminDocsSites({
    limit,
    offset,
    orgIdFilter
}: {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
}): Promise<AdminDocsSitesResponse | { error: string }> {
    if (USE_MOCK) {
        return getMockDocsSites({ limit, offset, orgIdFilter });
    }
    try {
        const session = await requireSuperUserSession();
        const params = new URLSearchParams();
        if (limit != null) {
            params.set("limit", String(limit));
        }
        if (offset != null) {
            params.set("offset", String(offset));
        }
        if (orgIdFilter) {
            params.set("orgIdFilter", orgIdFilter);
        }

        const query = params.toString();
        return await adminFetch<AdminDocsSitesResponse>(`/docs-sites${query ? `?${query}` : ""}`, session.accessToken);
    } catch (error: unknown) {
        console.error("[getAdminDocsSites] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch docs sites" };
    }
}

export async function getAdminDeployments({
    domain,
    basepath,
    limit,
    offset
}: {
    domain: string;
    basepath?: string;
    limit?: number;
    offset?: number;
}): Promise<AdminDeploymentsResponse | { error: string }> {
    if (USE_MOCK) {
        return getMockDeployments({ domain, limit, offset });
    }
    try {
        const session = await requireSuperUserSession();
        const params = new URLSearchParams();
        params.set("domain", domain);
        if (basepath != null) {
            params.set("basepath", basepath);
        }
        if (limit != null) {
            params.set("limit", String(limit));
        }
        if (offset != null) {
            params.set("offset", String(offset));
        }

        return await adminFetch<AdminDeploymentsResponse>(`/deployments?${params.toString()}`, session.accessToken);
    } catch (error: unknown) {
        console.error("[getAdminDeployments] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch deployments" };
    }
}

export async function getAdminOrgStats({
    limit,
    offset,
    orgIdFilter,
    sortBy,
    sortOrder
}: {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
    sortBy?: string;
    sortOrder?: string;
}): Promise<AdminOrgStatsResponse | { error: string }> {
    if (USE_MOCK) {
        return getMockOrgStats({ limit, offset, orgIdFilter, sortBy, sortOrder });
    }
    try {
        const session = await requireSuperUserSession();
        const params = new URLSearchParams();
        if (limit != null) {
            params.set("limit", String(limit));
        }
        if (offset != null) {
            params.set("offset", String(offset));
        }
        if (orgIdFilter) {
            params.set("orgIdFilter", orgIdFilter);
        }
        if (sortBy) {
            params.set("sortBy", sortBy);
        }
        if (sortOrder) {
            params.set("sortOrder", sortOrder);
        }

        const query = params.toString();
        return await adminFetch<AdminOrgStatsResponse>(`/org-stats${query ? `?${query}` : ""}`, session.accessToken);
    } catch (error: unknown) {
        console.error("[getAdminOrgStats] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch org stats" };
    }
}

export async function getAdminSiteDetails({
    limit,
    offset,
    orgIdFilter
}: {
    limit?: number;
    offset?: number;
    orgIdFilter?: string;
}): Promise<AdminSiteDetailsResponse | { error: string }> {
    if (USE_MOCK) {
        return getMockSiteDetails({ limit, offset, orgIdFilter });
    }
    try {
        const session = await requireSuperUserSession();
        const params = new URLSearchParams();
        if (limit != null) {
            params.set("limit", String(limit));
        }
        if (offset != null) {
            params.set("offset", String(offset));
        }
        if (orgIdFilter) {
            params.set("orgIdFilter", orgIdFilter);
        }

        const query = params.toString();
        return await adminFetch<AdminSiteDetailsResponse>(
            `/site-details${query ? `?${query}` : ""}`,
            session.accessToken
        );
    } catch (error: unknown) {
        console.error("[getAdminSiteDetails] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch site details" };
    }
}

// --- AI Supabase endpoints (uses PostgREST API directly to avoid adding @supabase/supabase-js dependency) ---

function getAiSupabaseConfig(): { url: string; key: string } {
    const url = process.env.AI_SUPABASE_URL;
    const key = process.env.AI_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("AI Supabase not configured (AI_SUPABASE_URL / AI_SUPABASE_SERVICE_ROLE_KEY)");
    }
    return { url, key };
}

async function aiSupabaseFetch(
    table: string,
    params: URLSearchParams,
    rangeStart: number,
    rangeEnd: number
): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const { url, key } = getAiSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Range: `${rangeStart}-${rangeEnd}`,
            Prefer: "count=exact"
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI Supabase error (${response.status}): ${text}`);
    }

    const contentRange = response.headers.get("content-range");
    const total = contentRange ? Number(contentRange.split("/")[1] ?? "0") : 0;
    const data = (await response.json()) as Record<string, unknown>[];
    return { data, total };
}

export async function getAdminReindexingJobs({
    limit,
    offset,
    domainFilter,
    statusFilter
}: {
    limit?: number;
    offset?: number;
    domainFilter?: string;
    statusFilter?: string;
}): Promise<{ jobs: AdminReindexingJob[]; total: number } | { error: string }> {
    if (USE_MOCK) {
        return getMockReindexingJobs({ limit, offset, domainFilter, statusFilter });
    }
    try {
        await requireSuperUserSession();

        const params = new URLSearchParams();
        params.set(
            "select",
            "id,domain,basepath,force_full_reindex,status,started_at,completed_at,created_at,updated_at,job_total_time_ms,num_inserted,num_deleted,error,reason,memory_mb,retry_count"
        );
        params.set("order", "updated_at.desc");
        if (domainFilter) {
            params.set("domain", `ilike.*${domainFilter}*`);
        }
        if (statusFilter) {
            params.set("status", `eq.${statusFilter}`);
        }

        const rangeStart = offset ?? 0;
        const rangeEnd = rangeStart + (limit ?? 50) - 1;
        const { data, total } = await aiSupabaseFetch("reindexing_jobs", params, rangeStart, rangeEnd);

        return {
            jobs: data.map((row) => ({
                id: String(row.id ?? ""),
                domain: String(row.domain ?? ""),
                basepath: row.basepath != null ? String(row.basepath) : null,
                force_full_reindex: row.force_full_reindex === true,
                status: String(row.status ?? ""),
                started_at: row.started_at != null ? String(row.started_at) : null,
                completed_at: row.completed_at != null ? String(row.completed_at) : null,
                created_at: String(row.created_at ?? ""),
                updated_at: String(row.updated_at ?? ""),
                job_total_time_ms: typeof row.job_total_time_ms === "number" ? row.job_total_time_ms : null,
                num_inserted: typeof row.num_inserted === "number" ? row.num_inserted : null,
                num_deleted: typeof row.num_deleted === "number" ? row.num_deleted : null,
                error: row.error != null ? String(row.error) : null,
                reason: row.reason != null ? String(row.reason) : null,
                memory_mb: typeof row.memory_mb === "number" ? row.memory_mb : null,
                retry_count: typeof row.retry_count === "number" ? row.retry_count : 0
            })),
            total
        };
    } catch (error: unknown) {
        console.error("[getAdminReindexingJobs] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch reindexing jobs" };
    }
}

export async function getAdminAiSettings({
    limit,
    offset,
    domainFilter
}: {
    limit?: number;
    offset?: number;
    domainFilter?: string;
}): Promise<{ settings: AdminAiSettings[]; total: number } | { error: string }> {
    if (USE_MOCK) {
        return getMockAiSettings({ limit, offset, domainFilter });
    }
    try {
        await requireSuperUserSession();

        const params = new URLSearchParams();
        params.set(
            "select",
            "domain,basepath,last_reindex_time,docs_enabled,slack_enabled,discord_enabled,is_preview,decompose_queries,org_name"
        );
        params.set("order", "last_reindex_time.desc.nullslast");
        if (domainFilter) {
            params.set("domain", `ilike.*${domainFilter}*`);
        }

        const rangeStart = offset ?? 0;
        const rangeEnd = rangeStart + (limit ?? 50) - 1;
        const { data, total } = await aiSupabaseFetch("settings", params, rangeStart, rangeEnd);

        return {
            settings: data.map((row) => ({
                domain: String(row.domain ?? ""),
                basepath: String(row.basepath ?? ""),
                last_reindex_time: row.last_reindex_time != null ? String(row.last_reindex_time) : null,
                docs_enabled: row.docs_enabled === true,
                slack_enabled: row.slack_enabled === true,
                discord_enabled: row.discord_enabled === true,
                is_preview: row.is_preview === true,
                decompose_queries: row.decompose_queries === true,
                org_name: row.org_name != null ? String(row.org_name) : null
            })),
            total
        };
    } catch (error: unknown) {
        console.error("[getAdminAiSettings] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch AI settings" };
    }
}
