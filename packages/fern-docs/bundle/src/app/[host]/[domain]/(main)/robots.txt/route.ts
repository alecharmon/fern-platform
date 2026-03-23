import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { COOKIE_FERN_TOKEN, FERN_DOCS_ORIGINS } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl, getSeoDisabled } from "@fern-docs/edge-config";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import urlJoin from "url-join";

interface RobotsRule {
    userAgent: string;
    allow?: string | string[];
    disallow?: string | string[];
}

interface RobotsConfig {
    rules: RobotsRule | RobotsRule[];
    sitemap?: string;
}

function formatRobotsTxt(config: RobotsConfig): string {
    const lines: string[] = [];
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    for (const rule of rules) {
        lines.push(`User-Agent: ${rule.userAgent}`);
        if (rule.allow) {
            const allows = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
            for (const a of allows) {
                lines.push(`Allow: ${a}`);
            }
        }
        if (rule.disallow) {
            const disallows = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
            for (const d of disallows) {
                lines.push(`Disallow: ${d}`);
            }
        }
        lines.push("");
    }

    if (config.sitemap) {
        lines.push(`Sitemap: ${config.sitemap}`);
        lines.push("");
    }

    return lines.join("\n");
}

function disallowAll(sitemap?: string): NextResponse {
    const config: RobotsConfig = {
        rules: { userAgent: "*", disallow: "/" },
        sitemap
    };
    return new NextResponse(formatRobotsTxt(config), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
}

export async function GET(
    _req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    if (isLocal()) {
        return disallowAll();
    }

    const { host, domain: rawDomain } = await props.params;
    const domain = decodeURIComponent(rawDomain);

    if (!domain) {
        return disallowAll();
    }

    const normalizedDomain = domain.toLowerCase().split(":")[0];
    if (normalizedDomain && FERN_DOCS_ORIGINS.includes(normalizedDomain)) {
        return disallowAll();
    }

    if (normalizedDomain?.endsWith(".ferndocs.com")) {
        return disallowAll();
    }

    const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;
    const loader = await createCachedDocsLoader(host, domain, fernToken);

    const config = await loader.getConfig();
    const canonicalUrl = config.metadata?.canonicalHost ?? (await getCanonicalUrl(domain));
    const headersList = await headers();
    const basepath = headersList.get("x-fern-basepath")?.replace(/\/$/, "") ?? "";
    const baseUrl = withDefaultProtocol(canonicalUrl ?? domain);
    const sitemap = urlJoin(baseUrl, basepath, "sitemap.xml");

    if (await getSeoDisabled(domain)) {
        return disallowAll(sitemap);
    }

    const robotsConfig: RobotsConfig = {
        sitemap,
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: "/api/fern-docs/"
        }
    };

    return new NextResponse(formatRobotsTxt(robotsConfig), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
}
