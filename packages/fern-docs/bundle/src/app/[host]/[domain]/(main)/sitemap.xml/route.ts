import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { COOKIE_FERN_TOKEN, conformTrailingSlash } from "@fern-api/docs-utils";
import { NodeCollector } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl } from "@fern-docs/edge-config";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import urljoin from "url-join";

function formatSitemapXml(urls: string[]): string {
    const entries = urls.map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
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
    const urls = slugs.map((slug) => conformTrailingSlash(urljoin(withDefaultProtocol(canonicalUrl ?? domain), slug)));

    return new NextResponse(formatSitemapXml(urls), {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8" }
    });
}
