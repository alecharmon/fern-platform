"use client";

import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Kbd } from "../ui/kbd";
import { GithubLogo } from "./GithubLogo";
import { GoogleLogo } from "./GoogleLogo";
import { PostmanLogo } from "./PostmanLogo";

// Used to prevent hydration errors
function useHasMounted() {
    const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => {
        setHasMounted(true);
    }, []);
    return hasMounted;
}

// Connection options for authentication providers
export type AuthConnection = "google-oauth2" | "github" | "enterprise-sso" | "postman";

export const LAST_USED_LOGIN_KEY = "fern-last-used-login";

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
    const handleClick = () => {
        try {
            localStorage.setItem(LAST_USED_LOGIN_KEY, connection);
        } catch {}
    };

    return (
        <Button {...buttonProps} asChild>
            <a href={getLoginUrl({ connection, returnTo, additionalParams })} onClick={handleClick}>
                {children}
            </a>
        </Button>
    );
};

// Google Login Button
export const GoogleLoginButton = ({
    returnTo,
    additionalParams,
    buttonProps,
    children,
    labelPrefix = "Continue with"
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
    labelPrefix?: string;
}) => {
    const [isLastUsed, setIsLastUsed] = useState(false);
    const [showRecommended, setShowRecommended] = useState(false);
    const hasMounted = useHasMounted();

    useEffect(() => {
        try {
            const lastUsed = localStorage.getItem(LAST_USED_LOGIN_KEY);
            setIsLastUsed(lastUsed === "google-oauth2");
            // Show "recommended" when there's no last used login method at all
            setShowRecommended(!lastUsed);
        } catch {
            setIsLastUsed(false);
            setShowRecommended(false);
        }
    }, []);

    return (
        <BaseLoginButton
            connection="google-oauth2"
            returnTo={returnTo}
            additionalParams={additionalParams}
            buttonProps={buttonProps}
        >
            {children ?? (
                <div className="w-full grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    <div aria-hidden="true" />
                    <div className="flex items-center gap-2 justify-self-center">
                        <GoogleLogo />
                        <span>{labelPrefix} Google</span>
                    </div>
                    {hasMounted && isLastUsed ? (
                        <Kbd className="justify-self-end -mr-1" useBodyFont>
                            last used
                        </Kbd>
                    ) : hasMounted && showRecommended ? (
                        <Kbd className="justify-self-end -mr-1" useBodyFont>
                            recommended
                        </Kbd>
                    ) : (
                        <div aria-hidden="true" />
                    )}
                </div>
            )}
        </BaseLoginButton>
    );
};

// GitHub Login Button
export const GithubLoginButton = ({
    returnTo,
    additionalParams,
    buttonProps,
    children,
    labelPrefix = "Continue with"
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
    labelPrefix?: string;
}) => {
    const [isLastUsed, setIsLastUsed] = useState(false);
    const hasMounted = useHasMounted();

    useEffect(() => {
        try {
            const lastUsed = localStorage.getItem(LAST_USED_LOGIN_KEY);
            setIsLastUsed(lastUsed === "github");
        } catch {
            setIsLastUsed(false);
        }
    }, []);

    return (
        <BaseLoginButton
            connection="github"
            returnTo={returnTo}
            additionalParams={additionalParams}
            buttonProps={buttonProps}
        >
            {children ?? (
                <div className="w-full grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    <div aria-hidden="true" />
                    <div className="flex items-center gap-2 justify-self-center">
                        <GithubLogo />
                        <span>{labelPrefix} GitHub</span>
                    </div>
                    {hasMounted && isLastUsed ? (
                        <Kbd className="justify-self-end" useBodyFont>
                            last used
                        </Kbd>
                    ) : (
                        <div aria-hidden="true" />
                    )}
                </div>
            )}
        </BaseLoginButton>
    );
};

// Postman Login Button
export const PostmanLoginButton = ({
    returnTo,
    additionalParams,
    buttonProps,
    children,
    labelPrefix = "Continue with"
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
    labelPrefix?: string;
}) => {
    const [isLastUsed, setIsLastUsed] = useState(false);
    const hasMounted = useHasMounted();

    useEffect(() => {
        try {
            const lastUsed = localStorage.getItem(LAST_USED_LOGIN_KEY);
            setIsLastUsed(lastUsed === "postman");
        } catch {
            setIsLastUsed(false);
        }
    }, []);

    return (
        <BaseLoginButton
            connection="postman"
            returnTo={returnTo}
            additionalParams={additionalParams}
            buttonProps={buttonProps}
        >
            {children ?? (
                <div className="w-full grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    <div aria-hidden="true" />
                    <div className="flex items-center gap-2 justify-self-center">
                        <PostmanLogo width={20} height={20} />
                        <span>{labelPrefix} Postman</span>
                    </div>
                    {hasMounted && isLastUsed ? (
                        <Kbd className="justify-self-end" useBodyFont>
                            last used
                        </Kbd>
                    ) : (
                        <div aria-hidden="true" />
                    )}
                </div>
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
