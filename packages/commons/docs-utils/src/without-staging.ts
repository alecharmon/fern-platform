import {
    FERN_DOCS_BUILDWITHFERN_COM,
    FERN_DOCS_DEV_BUILDWITHFERN_COM,
    FERN_DOCS_STAGING_BUILDWITHFERN_COM
} from "./constants";
import { isDevDomain, isStagingDomain } from "./isDevelopment";

export function withoutStaging(url: string): string {
    if (isStagingDomain(url)) {
        url = url.replace(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`, `.${FERN_DOCS_BUILDWITHFERN_COM}`);
    }
    return url;
}

export function withoutDev(url: string): string {
    if (isDevDomain(url)) {
        url = url.replace(`.${FERN_DOCS_DEV_BUILDWITHFERN_COM}`, `.${FERN_DOCS_BUILDWITHFERN_COM}`);
    }
    return url;
}

/**
 * Converts any environment-specific domain (staging, dev) to its production equivalent.
 * Use this for edge config lookups where entries may be stored under production domains.
 */
export function toProductionDomain(url: string): string {
    return withoutDev(withoutStaging(url));
}
