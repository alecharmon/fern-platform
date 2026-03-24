import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";

/**
 * Note: NEXT_PUBLIC_DOCS_DOMAIN is used for local development only.
 * When set to "ROOT", it is treated as unset, allowing the preview cookie flow to take over.
 */
export function getNextPublicDocsDomain(): string | undefined {
    try {
        const domain = process.env.NEXT_PUBLIC_DOCS_DOMAIN;

        if (domain == null || domain === "ROOT") {
            return undefined;
        }

        const url = new URL(withDefaultProtocol(domain));
        const basepath = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
        if (basepath) {
            return `${url.host}${basepath.replace(/\//g, "%2F")}`;
        }
        return url.host;
    } catch (e) {
        logger.error(`[next-public-docs-domain] ${JSON.stringify(e)}`);
        return undefined;
    }
}
