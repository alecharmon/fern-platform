import { FERN_DOCS_BUILDWITHFERN_COM, FERN_DOCS_STAGING_BUILDWITHFERN_COM } from "./constants";

export function withoutStaging(url: string): string {
    if (isStagingDomain(url)) {
        url = url.replace(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`, `.${FERN_DOCS_BUILDWITHFERN_COM}`);
    }
    return url;
}

export function isStagingDomain(host: string): boolean {
    return host.endsWith(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`);
}
