import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { conformTrailingSlash, HEADER_X_FERN_BASEPATH } from "@fern-api/docs-utils";
import { NodeCollector } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl } from "@fern-docs/edge-config";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import urljoin from "url-join";

import { getFernToken } from "./fern-token";
import { getDocsDomainApp, getDocsHostApp } from "./getDocsHostApp";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    if (isLocal()) {
        return [];
    }

    const headersList = await headers();
    const host = await getDocsHostApp();
    const domain = await getDocsDomainApp();

    // Read basepath from middleware header (set when basepath routes are matched)
    const basepath = headersList.get(HEADER_X_FERN_BASEPATH)?.replace(/\/$/, "") ?? "";

    // Combine domain with basepath to load the correct content for this basepath's site
    // This follows the same pattern as the Algolia reindex route
    const domainWithBasepath = basepath && basepath !== "/" ? `${domain}${basepath}` : domain;

    const loader = await createCachedDocsLoader(host, domainWithBasepath, await getFernToken());
    const root = await loader.getRoot();
    const config = await loader.getConfig();
    const canonicalUrl = config.metadata?.canonicalHost ?? (await getCanonicalUrl(domain));

    // collect all indexable page slugs
    const slugs = NodeCollector.collect(root).indexablePageSlugs;

    // convert slugs to full urls
    const urls = slugs.map((slug) => conformTrailingSlash(urljoin(withDefaultProtocol(canonicalUrl ?? domain), slug)));

    return [...urls.map((url) => ({ url }))];
}
