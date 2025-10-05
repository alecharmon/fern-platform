import "server-only";

import { AuthEdgeConfig } from "@fern-api/docs-auth";
import { AuthState } from "@fern-api/docs-server/auth/getAuthState";
import { getReturnToQueryParam } from "@fern-api/docs-server/auth/return-to";
import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isTrailingSlashEnabled } from "@fern-api/docs-utils";
import { FernButton } from "@fern-docs/components/FernButton";

import { LoginButtonClient } from "./login-button-client";
import { getApiRouteSupplier } from "./util/getApiRouteSupplier";

export async function LoginButton({
    loader,
    size,
    className,
    showIcon,
    disabled
}: {
    loader: DocsLoader;
    size?: "xs" | "sm" | "lg";
    className?: string;
    showIcon?: boolean;
    disabled?: boolean;
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
                Login
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
        />
    );
}

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
