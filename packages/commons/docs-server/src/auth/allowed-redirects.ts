/**
 * In order to prevent open-redirection, we need to curate a list of allowed domains where the server can redirect to.
 */

import type { AuthEdgeConfig, OAuth2, SSOWorkOS } from "@fern-api/docs-auth";
import { logger } from "@fern-api/ui-core-utils/logger";
import type { PreviewUrlAuth } from "@fern-docs/edge-config";
import { compact } from "es-toolkit/array";
import { UnreachableCaseError } from "ts-essentials";

const WORKOS_API_URL = "https://api.workos.com";

export function getAllowedRedirectUrls(
    authConfig?: AuthEdgeConfig | undefined,
    previewAuthConfig?: PreviewUrlAuth | undefined
): string[] {
    return [
        ...getAllowedRedirectUrlsForAuthConfig(authConfig),
        ...getAllowedRedirectUrlsForPreviewAuthConfig(previewAuthConfig)
    ];
}

function getAllowedRedirectUrlsForAuthConfig(authConfig?: AuthEdgeConfig) {
    if (authConfig == null) {
        return [];
    }

    switch (authConfig.type) {
        case "basic_token_verification":
            // since the `redirect` and `logout` are configured in the edge config, we can trust them
            return compact([authConfig.redirect, authConfig.logout]);
        case "sso":
            return getAllowedRedirectUrlsForSSO(authConfig);
        case "oauth2":
            return getAllowedRedirectUrlsForOAuth2(authConfig);
        case "password":
            // Password auth doesn't require external redirects
            return [];
        default:
            logger.error(new UnreachableCaseError(authConfig));
    }

    return [];
}

function getAllowedRedirectUrlsForPreviewAuthConfig(previewAuthConfig?: PreviewUrlAuth) {
    if (previewAuthConfig == null) {
        return [];
    }

    switch (previewAuthConfig.type) {
        case "workos":
            return [WORKOS_API_URL];
        default:
            logger.error(new UnreachableCaseError(previewAuthConfig.type));
    }

    return [];
}

function getAllowedRedirectUrlsForSSO(_authConfig: SSOWorkOS) {
    return [WORKOS_API_URL];
}

function getAllowedRedirectUrlsForOAuth2(authConfig: OAuth2) {
    if ("redirect_urls" in authConfig && typeof authConfig.redirect_urls === "string") {
        return [authConfig.redirect_urls];
    }

    if ("redirect_urls" in authConfig && Array.isArray(authConfig.redirect_urls)) {
        return authConfig.redirect_urls;
    }

    return [];
}
