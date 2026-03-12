import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { FERN_DOCS_ORIGINS, HEADER_HOST, HEADER_X_FERN_HOST } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl, getSeoDisabled } from "@fern-docs/edge-config";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import urlJoin from "url-join";
import { getFernToken } from "./fern-token";
import { getDocsDomainApp, getDocsHostApp } from "./getDocsHostApp";

export default async function robots(): Promise<MetadataRoute.Robots> {
    if (isLocal()) {
        return {
            rules: {
                userAgent: "*",
                disallow: "/"
            }
        };
    }

    const headersList = await headers();
    const domain = headersList.get(HEADER_X_FERN_HOST) ?? headersList.get(HEADER_HOST) ?? (await getDocsDomainApp());

    if (!domain) {
        return {
            rules: {
                userAgent: "*",
                disallow: "/"
            }
        };
    }

    // FERN_DOCS_ORIGINS are the platform's own deployment domains (e.g. app.buildwithfern.com),
    // not customer docs sites. Return disallow-all to avoid creating a docs loader which would
    // throw in assertDocsDomain.
    const normalizedDomain = domain.toLowerCase().split(":")[0];
    if (normalizedDomain && FERN_DOCS_ORIGINS.includes(normalizedDomain)) {
        return {
            rules: {
                userAgent: "*",
                disallow: "/"
            }
        };
    }

    // Disallow non-origin .ferndocs.com subdomains (e.g. customer preview domains)
    if (normalizedDomain?.endsWith(".ferndocs.com")) {
        return {
            rules: {
                userAgent: "*",
                disallow: "/"
            }
        };
    }

    const host = await getDocsHostApp();
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());

    const config = await loader.getConfig();
    const canonicalUrl = config.metadata?.canonicalHost ?? (await getCanonicalUrl(domain));
    const basepath = headersList.get("x-fern-basepath")?.replace(/\/$/, "") ?? "";
    const baseUrl = withDefaultProtocol(canonicalUrl ?? domain);
    const sitemap = urlJoin(baseUrl, basepath, "sitemap.xml");

    if (await getSeoDisabled(domain)) {
        return {
            sitemap,
            rules: {
                userAgent: "*",
                disallow: "/"
            }
        };
    }

    return {
        sitemap,
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: "/api/fern-docs/"
        }
    };
}
