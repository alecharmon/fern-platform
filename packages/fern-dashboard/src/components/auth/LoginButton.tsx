"use client";

import { useEffect, useState } from "react";

import { cn } from "@/utils/utils";

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
    labelPrefix = "Continue with",
    logoVariant = "colorful"
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
    labelPrefix?: string;
    logoVariant?: "colorful" | "white";
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
        <div className="relative">
            {hasMounted && isLastUsed ? (
                <Kbd
                    className="absolute left-1/2 -translate-x-1/2 top-[-14px] w-max bg-background text-foreground dark:text-foreground border border-border shadow-xs"
                    useBodyFont
                >
                    Last used
                </Kbd>
            ) : hasMounted && showRecommended ? (
                <Kbd
                    className="absolute left-1/2 -translate-x-1/2 top-[-14px] w-max bg-background text-foreground dark:text-foreground border border-border shadow-xs"
                    useBodyFont
                >
                    Recommended
                </Kbd>
            ) : null}
            <BaseLoginButton
                connection="google-oauth2"
                returnTo={returnTo}
                additionalParams={additionalParams}
                buttonProps={{ variant: "outline", ...buttonProps, className: cn("w-full", buttonProps?.className) }}
            >
                {children ?? (
                    <div className="flex items-center gap-2 justify-center">
                        <GoogleLogo variant={logoVariant} />
                        <span>{labelPrefix ? `${labelPrefix} ` : ""}Google</span>
                    </div>
                )}
            </BaseLoginButton>
        </div>
    );
};

// GitHub Login Button
export const GithubLoginButton = ({
    returnTo,
    additionalParams,
    buttonProps,
    children,
    labelPrefix = "Continue with",
    logoVariant = "filled"
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
    labelPrefix?: string;
    logoVariant?: "filled" | "white";
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
        <div className="relative">
            {hasMounted && isLastUsed ? (
                <Kbd
                    className="absolute left-1/2 -translate-x-1/2 top-[-14px] w-max bg-background text-foreground dark:text-foreground border border-border shadow-xs"
                    useBodyFont
                >
                    Last used
                </Kbd>
            ) : null}
            <BaseLoginButton
                connection="github"
                returnTo={returnTo}
                additionalParams={additionalParams}
                buttonProps={{ variant: "outline", ...buttonProps, className: cn("w-full", buttonProps?.className) }}
            >
                {children ?? (
                    <div className="flex items-center gap-2 justify-center">
                        <GithubLogo variant={logoVariant} />
                        <span>{labelPrefix ? `${labelPrefix} ` : ""}GitHub</span>
                    </div>
                )}
            </BaseLoginButton>
        </div>
    );
};

export const PostmanLoginButton = ({
    returnTo,
    additionalParams,
    buttonProps,
    children,
    labelPrefix = "",
    logoVariant = "colorful"
}: {
    returnTo?: string;
    additionalParams?: Record<string, string>;
    buttonProps?: React.ComponentProps<typeof Button>;
    children?: React.ReactNode;
    labelPrefix?: string;
    logoVariant?: "colorful" | "white";
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
        <div className="relative">
            {hasMounted && isLastUsed ? (
                <Kbd
                    className="absolute left-1/2 -translate-x-1/2 top-[-14px] w-max bg-background text-foreground dark:text-foreground border border-border shadow-xs"
                    useBodyFont
                >
                    Last used
                </Kbd>
            ) : null}
            <BaseLoginButton
                connection="postman"
                returnTo={returnTo}
                additionalParams={additionalParams}
                buttonProps={{ variant: "outline", ...buttonProps, className: cn("w-full", buttonProps?.className) }}
            >
                {children ?? (
                    <div className="flex items-center gap-2 justify-center">
                        <PostmanLogo variant={logoVariant} />
                        <span>{labelPrefix ? `${labelPrefix} ` : ""}Postman</span>
                    </div>
                )}
            </BaseLoginButton>
        </div>
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
