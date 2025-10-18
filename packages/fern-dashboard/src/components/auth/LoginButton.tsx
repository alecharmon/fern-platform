"use client";

import { Button } from "../ui/button";
import { GithubLogo } from "./GithubLogo";
import { GoogleLogo } from "./GoogleLogo";

// Connection options for authentication providers
export type AuthConnection = "google-oauth2" | "github";

// Base login button component that can be used for different providers
const BaseLoginButton = ({
    connection,
    returnTo,
    additionalParams,
    buttonProps,
    children
}: {
    connection: AuthConnection;
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
}) => {
    return (
        <Button {...buttonProps} asChild>
            <a href={getLoginUrl({ connection, returnTo, additionalParams })}>{children}</a>
        </Button>
    );
};

// Google Login Button
export const GoogleLoginButton = ({
    returnTo,
    additionalParams,
    buttonProps,
    children
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
}) => {
    return (
        <BaseLoginButton
            connection="google-oauth2"
            returnTo={returnTo}
            additionalParams={additionalParams}
            buttonProps={buttonProps}
        >
            {children ?? (
                <>
                    <GoogleLogo />
                    Continue with Google
                </>
            )}
        </BaseLoginButton>
    );
};

// GitHub Login Button
export const GithubLoginButton = ({
    returnTo,
    additionalParams,
    buttonProps,
    children
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
}) => {
    return (
        <BaseLoginButton
            connection="github"
            returnTo={returnTo}
            additionalParams={additionalParams}
            buttonProps={buttonProps}
        >
            {children ?? (
                <>
                    <GithubLogo />
                    Continue with GitHub
                </>
            )}
        </BaseLoginButton>
    );
};

function getLoginUrl({
    connection,
    returnTo,
    additionalParams
}: {
    connection: AuthConnection;
    returnTo?: string;
    additionalParams?: Record<string, string>;
}) {
    const searchParams = new URLSearchParams(additionalParams);
    if (returnTo != null) {
        searchParams.append("redirect_on_login", returnTo);
    }
    searchParams.append("connection", connection);
    return `/auth/login?${searchParams.toString()}`;
}
