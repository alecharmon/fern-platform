import "server-only";

import type { AuthEdgeConfig } from "@fern-api/docs-auth";
import type { AuthState } from "@fern-api/docs-server/auth/getAuthState";
import { getReturnToQueryParam } from "@fern-api/docs-server/auth/return-to";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isTrailingSlashEnabled } from "@fern-api/docs-utils";
import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";

import { LoginButtonClient } from "./login-button-client";
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
    const [authConfig, authState, { basePath }] = await Promise.all([
        loader.getAuthConfig(),
        loader.getAuthState(),
        loader.getMetadata()
    ]);

    if (!authConfig) {
        return null;
    }

    if (disabled) {
        return (
            <FernButton variant="outlined" className={className} disabled>
                {t(lang).auth.login}
            </FernButton>
        );
    }

    if (shouldHideLoginButton(authConfig)) {
        return null;
    }

    const getApiRoute = getApiRouteSupplier({
        basepath: basePath,
        includeTrailingSlash: isTrailingSlashEnabled()
    });

    const logoutUrl = getApiRoute("/api/fern-docs/auth/logout");
    const loginUrl = getLoginUrl({ authConfig, authState });

    const href = authState.authed ? logoutUrl : loginUrl;

    if (!href) {
        return null;
    }

    return (
        <LoginButtonClient
            authed={authState.authed}
            returnToQueryParam={getReturnToQueryParam(authConfig)}
            href={href}
            size={size}
            className={className}
            showIcon={showIcon}
            id="fern-auth-button"
            disabled={disabled}
            lang={lang}
        />
    );
}

const shouldHideLoginButton = (authConfig: AuthEdgeConfig) => {
    // if all pages are allowed
    if (authConfig.allowlist?.includes("/(.*)")) {
        return true;
    }

    return false;
};

const getLoginUrl = ({ authConfig, authState }: { authConfig: AuthEdgeConfig; authState: AuthState }) => {
    if (!authState.authed) {
        return authState.authorizationUrl;
    }

    if (authConfig.type === "basic_token_verification") {
        return authConfig.redirect;
    }

    if (authConfig.type === "oauth2" && "auth_endpoint" in authConfig) {
        return authConfig.auth_endpoint;
    }

    return undefined;
};
