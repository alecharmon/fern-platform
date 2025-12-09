import { FdrClient } from "@fern-api/fdr-sdk/client";
import { uniq } from "es-toolkit/array";

/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Get all production domains from the Vercel KV store or FDR
 *
 * This mirrors the logic from fern-docs/bundle deployment-promoted route
 * to get all active production docs sites.
 */
if (process.env.NODE_ENV !== "test") {
    require("server-only");
}

/**
 * Get a KV client for the docs bundle's KV store.
 * Uses DOCS_KV_* prefixed env vars to avoid conflicts with dashboard's own KV.
 */
async function getDocsKvClient(): Promise<any | null> {
    const url = process.env.DOCS_KV_REST_API_URL;
    const token = process.env.DOCS_KV_REST_API_TOKEN;

    if (!url || !token) {
        return null;
    }

    try {
        const { createClient } = await import("@vercel/kv");
        return createClient({ url, token });
    } catch (_error) {
        console.warn("[getDocsKvClient] Failed to import @vercel/kv, will use FDR fallback");
        return null;
    }
}

const FERN_DOCS_BUILDWITHFERN_COM = "docs.buildwithfern.com";
const FERN_DOCS_STAGING_BUILDWITHFERN_COM = "docs.staging.buildwithfern.com";
const FERN_DOCS_DEV_BUILDWITHFERN_COM = "docs.dev.buildwithfern.com";

function isStagingDomain(host: string): boolean {
    return host.endsWith(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`);
}

function withoutStaging(url: string): string {
    if (isStagingDomain(url)) {
        return url.replace(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`, `.${FERN_DOCS_BUILDWITHFERN_COM}`);
    }
    return url;
}

function isProductionDomain(domain: string): boolean {
    return (
        !domain.endsWith(`.${FERN_DOCS_BUILDWITHFERN_COM}`) &&
        !domain.endsWith(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`) &&
        !domain.endsWith(`.${FERN_DOCS_DEV_BUILDWITHFERN_COM}`)
    );
}

export interface ProductionDomain {
    domain: string;
    isCustomDomain: boolean;
    orgId?: string;
}

/**
 * Fetches all production domains from the KV store (if available) or FDR.
 *
 * Filters out:
 * - Staging domains (*.docs.staging.buildwithfern.com)
 * - Dev domains (*.docs.dev.buildwithfern.com)
 * - Preview domains (*.docs.buildwithfern.com) - these are Fern-hosted preview URLs
 *
 * Returns unique production domains (custom domains like docs.example.com)
 */
export async function getAllProductionDomains(): Promise<ProductionDomain[]> {
    const cdnUri = process.env.NEXT_PUBLIC_CDN_URI;
    const docsKv = await getDocsKvClient();

    // If docs KV is available with CDN_URI, try that first (faster)
    if (docsKv && cdnUri) {
        const kvDomains = await getAllProductionDomainsFromKV(docsKv, cdnUri);
        if (kvDomains.length > 0) {
            return kvDomains;
        }
        console.log("[getAllProductionDomains] KV returned empty, falling back to FDR");
    }

    // Fall back to FDR
    return getAllProductionDomainsFromFDR();
}

/**
 * Get production domains from Vercel KV store
 */
async function getAllProductionDomainsFromKV(kv: any, cdnUri: string): Promise<ProductionDomain[]> {
    const rawDomains = (await kv.smembers(`${cdnUri}:domains`)) as string[];

    const domains = uniq(rawDomains.filter(isProductionDomain).map(withoutStaging)).sort();

    return domains.map((domain) => ({
        domain,
        isCustomDomain: !domain.endsWith(".buildwithfern.com")
    }));
}

/**
 * Get production domains from FDR (Fern Definition Registry)
 */
async function getAllProductionDomainsFromFDR(): Promise<ProductionDomain[]> {
    const fdrServerUrl = process.env.FDR_SERVER_URL ?? process.env.NEXT_PUBLIC_FDR_ORIGIN;
    const fernToken = process.env.FERN_TOKEN;

    if (!fdrServerUrl) {
        throw new Error("FDR_SERVER_URL or NEXT_PUBLIC_FDR_ORIGIN environment variable is required");
    }
    if (!fernToken) {
        throw new Error("FERN_TOKEN environment variable is required");
    }

    console.log(`[getAllProductionDomainsFromFDR] Fetching from ${fdrServerUrl}...`);

    const fdr = new FdrClient({
        environment: fdrServerUrl,
        token: fernToken
    });

    const domainToOrg = new Map<string, string>();
    let page = 1;
    const limit = 1000;
    let hasMore = true;
    let totalFetched = 0;

    while (hasMore) {
        console.log(`[getAllProductionDomainsFromFDR] Fetching page ${page}...`);
        const response = await fdr.docs.v2.read.listAllDocsUrls({ page, limit });

        if (!response.ok) {
            throw new Error(`Failed to fetch docs URLs: ${JSON.stringify(response.error)}`);
        }

        const { urls } = response.body;
        totalFetched += urls.length;
        console.log(`[getAllProductionDomainsFromFDR] Got ${urls.length} URLs (total: ${totalFetched})`);

        for (const url of urls) {
            const domain = withoutStaging(url.domain);
            if (isProductionDomain(domain)) {
                domainToOrg.set(domain, url.organizationId);
            }
        }

        hasMore = urls.length === limit;
        page++;
    }

    const sortedDomains = Array.from(domainToOrg.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    console.log(`[getAllProductionDomainsFromFDR] Found ${sortedDomains.length} production domains`);

    return sortedDomains.map(([domain, orgId]) => ({
        domain,
        isCustomDomain: !domain.endsWith(".buildwithfern.com"),
        orgId
    }));
}

/**
 * Get all domains including Fern-hosted preview domains (*.docs.buildwithfern.com)
 * Use this if you need to include preview/staging sites.
 */
export async function getAllDomainsIncludingPreviews(): Promise<string[]> {
    const cdnUri = process.env.NEXT_PUBLIC_CDN_URI;
    const docsKv = await getDocsKvClient();

    if (docsKv && cdnUri) {
        const rawDomains = (await docsKv.smembers(`${cdnUri}:domains`)) as string[];
        return uniq(
            rawDomains
                .filter(
                    (domain: string) =>
                        !domain.endsWith(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`) &&
                        !domain.endsWith(`.${FERN_DOCS_DEV_BUILDWITHFERN_COM}`)
                )
                .map(withoutStaging)
        ).sort();
    }

    // Fall back to FDR - returns all domains
    const domains = await getAllProductionDomainsFromFDR();
    return domains.map((d) => d.domain);
}
