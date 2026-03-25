import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getFdrOrigin } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { COOKIE_FERN_TOKEN, conformTrailingSlash } from "@fern-api/docs-utils";
import { FdrClient } from "@fern-api/fdr-sdk/client";
import { NodeCollector } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getCanonicalUrl } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import urljoin from "url-join";

interface SitemapEntry {
    url: string;
    lastModified?: Date;
}

function formatSitemapXml(entries: SitemapEntry[]): string {
    const urlEntries = entries
        .map((entry) => {
            const lastmod = entry.lastModified ? `\n    <lastmod>${entry.lastModified.toISOString()}</lastmod>` : "";
            return `  <url>\n    <loc>${escapeXml(entry.url)}</loc>${lastmod}\n  </url>`;
        })
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * The [domain] URL param may contain an embedded basepath (e.g. "domain.com%2Fnemo")
 * when the proxy encodes domain+basepath as a single route parameter. Split it back
 * into the pure domain and basepath so DB lookups use the correct column values.
 */
function splitDomainAndBasepath(rawDomain: string): { pureDomain: string; basepath: string } {
    const decoded = decodeURIComponent(rawDomain);
    const slashIndex = decoded.indexOf("/");
    if (slashIndex === -1) {
        return { pureDomain: decoded, basepath: "" };
    }
    return {
        pureDomain: decoded.slice(0, slashIndex),
        basepath: decoded.slice(slashIndex)
    };
}

export async function GET(
    _req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    if (isLocal()) {
        return new NextResponse(formatSitemapXml([]), {
            status: 200,
            headers: { "Content-Type": "application/xml; charset=utf-8" }
        });
    }

    const { host, domain: rawDomain } = await props.params;
    // `domain` includes the basepath (e.g. "example.com/subpath") and is used as-is
    // for the docs loader which expects the combined form.
    const domain = decodeURIComponent(rawDomain);
    // Split into pure domain + basepath for DB lookups and canonical URL generation,
    // since the slugs table stores them as separate columns.
    const { pureDomain, basepath } = splitDomainAndBasepath(rawDomain);

    const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;
    const loader = await createCachedDocsLoader(host, domain, fernToken);
    const root = await loader.getRoot();
    const config = await loader.getConfig();
    const canonicalUrl = config.metadata?.canonicalHost ?? (await getCanonicalUrl(pureDomain));

    const slugs = NodeCollector.collect(root).indexablePageSlugs;

    const slugToLastUpdated = new Map<string, Date>();
    try {
        const fdr = new FdrClient({ environment: getFdrOrigin(), token: process.env.JWT_SECRET_KEY ?? "" });
        const response = await fdr.slugs.getSlugEntries({ domain: pureDomain, basepath });
        for (const entry of response.entries) {
            if (entry.slug) {
                slugToLastUpdated.set(entry.slug, new Date(entry.lastUpdated));
            }
        }
    } catch (e) {
        logger.error("[sitemap] Failed to fetch slug entries from FDR:", e);
    }

    const entries = slugs.map((slug) => {
        const url = conformTrailingSlash(urljoin(withDefaultProtocol(canonicalUrl ?? pureDomain), slug));
        const lastModified = slugToLastUpdated.get(slug);
        return lastModified != null ? { url, lastModified } : { url };
    });

    return new NextResponse(formatSitemapXml(entries), {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8" }
    });
}
