import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import urlJoin from "url-join";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { HEADER_HOST, HEADER_X_FERN_HOST } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl, getSeoDisabled } from "@fern-docs/edge-config";
import { getFernToken } from "./fern-token";
import { getDocsDomainApp, getDocsHostApp } from "@fern-api/docs-server/xfernhost/app";
import { createCachedDocsLoader } from "@fern-api/docs-loader";

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
    const host = await getDocsHostApp();
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());

    if (!domain) {
        return {
            rules: {
                userAgent: "*",
                disallow: "/"
            }
        };
    }

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
