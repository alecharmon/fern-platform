import type { DocsSite, DocsSiteUrl } from "@fern-api/fdr-sdk/orpc-client";

import type { DocsUrl } from "./types";

export function getDocsSiteUrl({ mainUrl }: DocsSite): DocsUrl {
    return convertFdrDocsSiteUrlToDocsUrl(mainUrl);
}

export function convertFdrDocsSiteUrlToDocsUrl(url: DocsSiteUrl): DocsUrl {
    if (url.path == null) {
        return url.domain as DocsUrl;
    }
    return `${url.domain}${url.path}` as DocsUrl;
}
