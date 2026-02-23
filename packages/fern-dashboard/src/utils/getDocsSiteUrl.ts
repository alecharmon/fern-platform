import type { DashboardDocsSite, DocsSiteUrl } from "@fern-api/fdr-sdk/orpc-client";

import type { DocsUrl } from "./types";

export function getDocsSiteUrl({ mainUrl }: DashboardDocsSite): DocsUrl {
    return convertFdrDocsSiteUrlToDocsUrl(mainUrl);
}

export function convertFdrDocsSiteUrlToDocsUrl(url: DocsSiteUrl): DocsUrl {
    if (url.path == null) {
        return url.domain as DocsUrl;
    }
    return `${url.domain}${url.path}` as DocsUrl;
}
