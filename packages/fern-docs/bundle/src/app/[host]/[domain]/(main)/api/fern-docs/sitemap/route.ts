import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getFdrOrigin } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { COOKIE_FERN_TOKEN, conformTrailingSlash } from "@fern-api/docs-utils";
import { FdrClient } from "@fern-api/fdr-sdk/client";
import { NodeCollector } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl } from "@fern-docs/edge-config";
import { cookies, headers } from "next/headers";
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
    const domain = decodeURIComponent(rawDomain);

    const headersList = await headers();
    const basepath = headersList.get("x-fern-basepath")?.replace(/\/$/, "") ?? "";
    const domainWithBasepath = basepath && basepath !== "/" ? `${domain}${basepath}` : domain;

    const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;
    const loader = await createCachedDocsLoader(host, domainWithBasepath, fernToken);
    const root = await loader.getRoot();
    const config = await loader.getConfig();
    const canonicalUrl = config.metadata?.canonicalHost ?? (await getCanonicalUrl(domain));

    const slugs = NodeCollector.collect(root).indexablePageSlugs;

    const slugToLastUpdated = new Map<string, Date>();
    try {
        const fdr = new FdrClient({ environment: getFdrOrigin(), token: process.env.FERN_TOKEN ?? "" });
        const response = await fdr.slugs.getSlugEntries({ domain, basepath });
        for (const entry of response.entries) {
            if (entry.slug) {
                slugToLastUpdated.set(entry.slug, new Date(entry.lastUpdated));
            }
        }
    } catch {
        // Non-fatal: if slugs are not available, omit lastmod
    }

    const entries = slugs.map((slug) => {
        const url = conformTrailingSlash(urljoin(withDefaultProtocol(canonicalUrl ?? domain), slug));
        const lastModified = slugToLastUpdated.get(slug);
        return lastModified != null ? { url, lastModified } : { url };
    });

    return new NextResponse(formatSitemapXml(entries), {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8" }
    });
}
