import { BUILDWITHFERN_COM, FERN_DOCS_PREVIEW_DOMAINS } from "./constants";
import { isDevelopment } from "./isDevelopment";
import { isSelfHosted } from "./isSelfHosted";

export function isCustomDomain(host: string): boolean {
    if (!isSelfHosted() && isDevelopment(host)) {
        return false;
    }

    if (isFern(host)) {
        return true;
    }

    for (const domain of FERN_DOCS_PREVIEW_DOMAINS) {
        if (host.endsWith(`.${domain}`)) {
            return false;
        }
    }

    return true;
}

/**
 * Fern's docs are hosted on `buildwithfern.com/learn`
 */
export function isFern(host: string): boolean {
    return host === BUILDWITHFERN_COM;
}
