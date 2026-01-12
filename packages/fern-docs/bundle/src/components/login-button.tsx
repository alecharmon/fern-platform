import "server-only";

import type { AuthEdgeConfig } from "@fern-api/docs-auth";
import { getAuthMethodDisplayName, getAuthMethodId } from "@fern-api/docs-auth";
import type { AuthState } from "@fern-api/docs-server/auth/getAuthState";
import { getAuthorizationUrl, getPasswordAuthorizationUrl } from "@fern-api/docs-server/auth/getAuthState";
import { getReturnToQueryParam } from "@fern-api/docs-server/auth/return-to";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isTrailingSlashEnabled } from "@fern-api/docs-utils";
import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";
import { headers } from "next/headers";

import { LoginButtonClient } from "./login-button-client";
import { type AuthMethodOption, LoginButtonDropdown } from "./login-button-dropdown";
import { getApiRouteSupplier } from "./util/getApiRouteSupplier";

export async function LoginButton({
    loader,
    size,
    className,
    showIcon,
    disabled,
    lang
}: {
    loader: DocsLoader;
    size?: "xs" | "sm" | "lg";
    className?: string;
    showIcon?: boolean;
    disabled?: boolean;
    lang: string;
}) {
    const [authConfigs, authState, metadata] = await Promise.all([
        loader.getAuthConfigs(),
        loader.getAuthState(),
        loader.getMetadata()
    ]);

    const { basePath, domain } = metadata;

    if (authConfigs.length === 0) {
        return null;
    }

    if (disabled) {
        return (
            <FernButton variant="outlined" className={className} disabled>
                {t(lang).auth.login}
            </FernButton>
        );
    }

    const getApiRoute = getApiRouteSupplier({
        basepath: basePath,
        includeTrailingSlash: isTrailingSlashEnabled()
    });

    const logoutUrl = getApiRoute("/api/fern-docs/auth/logout");

    // If user is already authenticated, show logout button
    if (authState.authed) {
        const authConfig = authConfigs[0];
        if (!authConfig) {
            return null;
        }
        return (
            <LoginButtonClient
                authed={true}
                returnToQueryParam={getReturnToQueryParam(authConfig)}
                href={logoutUrl}
                size={size}
                className={className}
                showIcon={showIcon}
                id="fern-auth-button"
                disabled={disabled}
                lang={lang}
            />
        );
    }

    // Filter out auth configs that should be hidden
    const visibleAuthConfigs = authConfigs.filter((config) => !shouldHideLoginButton(config));

    if (visibleAuthConfigs.length === 0) {
        return null;
    }

    // Get host from headers for generating authorization URLs
    const headersList = await headers();
    const host = headersList.get("x-fern-host") ?? headersList.get("host") ?? domain;

    // If there's only one auth config, show a single login button
    if (visibleAuthConfigs.length === 1) {
        const authConfig = visibleAuthConfigs[0];
        if (!authConfig) {
            return null;
        }

        const loginUrl = getLoginUrlForConfig(authConfig, authState, host, domain);

        if (!loginUrl) {
            return null;
        }

        return (
            <LoginButtonClient
                authed={false}
                returnToQueryParam={getReturnToQueryParam(authConfig)}
                href={loginUrl}
                size={size}
                className={className}
                showIcon={showIcon}
                id="fern-auth-button"
                disabled={disabled}
                lang={lang}
            />
        );
    }

    // Multiple auth configs - show dropdown
    const authMethods: AuthMethodOption[] = visibleAuthConfigs
        .map((config) => {
            const loginUrl = getLoginUrlForConfig(config, authState, host, domain);
            if (!loginUrl) {
                return null;
            }
            return {
                id: getAuthMethodId(config),
                name: getAuthMethodDisplayName(config),
                loginUrl,
                returnToQueryParam: getReturnToQueryParam(config)
            };
        })
        .filter((method): method is AuthMethodOption => method !== null);

    if (authMethods.length === 0) {
        return null;
    }

    return (
        <LoginButtonDropdown
            authMethods={authMethods}
            size={size}
            className={className}
            showIcon={showIcon}
            lang={lang}
        />
    );
}

const getLoginUrlForConfig = (
    authConfig: AuthEdgeConfig,
    authState: AuthState,
    host: string,
    domain: string
): string | undefined => {
    // If user is not authenticated, generate authorization URL
    if (!authState.authed) {
        if (authConfig.type === "password") {
            return getPasswordAuthorizationUrl(host, domain);
        }
        return getAuthorizationUrl(authConfig, host, domain);
    }

    // If user is authenticated, return the redirect URL for re-authentication
    if (authConfig.type === "basic_token_verification") {
        return authConfig.redirect;
    }

    if (authConfig.type === "oauth2" && "auth_endpoint" in authConfig) {
        return authConfig.auth_endpoint;
    }

    return undefined;
};

const shouldHideLoginButton = (authConfig: AuthEdgeConfig) => {
    // todo: deprecate webflow and ory
    if (authConfig.type === "oauth2" && (authConfig.partner === "webflow" || authConfig.partner === "ory")) {
        return true;
    }

    // if all pages are allowed
    if (authConfig.allowlist?.includes("/(.*)")) {
        return true;
    }

    return false;
};
