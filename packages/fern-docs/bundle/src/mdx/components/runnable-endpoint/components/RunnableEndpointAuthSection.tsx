"use client";

import type { AuthScheme } from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { cn } from "@fern-docs/components/cn";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { FernInput } from "@fern-docs/components/FernInput";
import { t } from "@fern-docs/i18n";
import * as Select from "@radix-ui/react-select";
import { useAtom } from "jotai";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { PasswordInputGroup } from "@/components/playground/PasswordInputGroup";
import {
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_ATOM,
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_ATOM,
    PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM,
    PLAYGROUND_AUTH_STATE_HEADER_ATOM
} from "@/state/playground";

interface RunnableEndpointAuthSectionProps {
    authSchemes: AuthScheme[];
    lang: string;
}

function getAuthSchemeLabel(auth: AuthScheme, lang: string): string {
    return visitDiscriminatedUnion(auth)._visit({
        bearerAuth: (bearer) => bearer.tokenName || t(lang).auth.bearerToken,
        basicAuth: (basic) => basic.usernameName || t(lang).auth.basicAuth,
        header: (header) => header.nameOverride || header.headerWireValue,
        oAuth: () => t(lang).auth.oauthToken,
        _other: () => t(lang).apiReference.authentication
    });
}

function getAuthSchemeValue(index: number): string {
    return `auth-${index}`;
}

export function RunnableEndpointAuthSection({ authSchemes, lang }: RunnableEndpointAuthSectionProps) {
    const [selectedAuthIndex, setSelectedAuthIndex] = useState(0);
    const [open, openState] = useState(true);

    if (authSchemes.length === 0) {
        return null;
    }

    const selectedAuth = authSchemes[selectedAuthIndex];

    if (!selectedAuth) {
        return null;
    }

    const hasMultipleSchemes = authSchemes.length > 1;

    return (
        <section className="fern-runnable-auth">
            <button
                type="button"
                onClick={() => openState(!open)}
                className="fern-runnable-auth-toggle text-(color:--grayscale-a11) mb-2 flex w-full items-center justify-between text-sm font-medium hover:text-(color:--grayscale-a12) transition-colors"
            >
                <h5 className="fern-runnable-auth-title text-(color:--grayscale-a11) text-sm font-medium">
                    {t(lang).apiReference.authentication}
                </h5>
                <ChevronDown
                    className={cn("size-4 transition-transform duration-200", open ? "rotate-180" : "rotate-0")}
                />
            </button>
            <FernCollapse open={open} onOpenChange={openState}>
                <div className="fern-runnable-auth-content bg-(color:--grayscale-a2) rounded-2 p-3">
                    <div className="fern-runnable-auth-fields space-y-3">
                        {hasMultipleSchemes && (
                            <div className="space-y-2">
                                <label className="text-text-secondary text-xs font-medium">
                                    {t(lang).apiReference.authType}
                                </label>
                                <Select.Root
                                    value={getAuthSchemeValue(selectedAuthIndex)}
                                    onValueChange={(value) => {
                                        const index = parseInt(value.replace("auth-", ""), 10);
                                        if (!isNaN(index)) {
                                            setSelectedAuthIndex(index);
                                        }
                                    }}
                                >
                                    <Select.Trigger
                                        className={cn(
                                            "flex h-8 w-full items-center justify-between rounded-2 bg-card-background px-2.5 py-2 text-sm text-(color:--grayscale-a12)",
                                            "ring-border-default ring-1 ring-inset",
                                            "hover:bg-(color:--grayscale-a2) focus-within:ring-(color:--accent-a5) focus-within:ring-2 focus:outline-none transition-colors"
                                        )}
                                    >
                                        <Select.Value />
                                        <Select.Icon>
                                            <ChevronDown className="size-4" />
                                        </Select.Icon>
                                    </Select.Trigger>
                                    <Select.Portal>
                                        <Select.Content
                                            position="popper"
                                            className={cn(
                                                "rounded-2 bg-background border-border-default border shadow-xl backdrop-blur",
                                                "z-50 overflow-hidden",
                                                "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1"
                                            )}
                                        >
                                            <Select.ScrollUpButton className="flex h-6 cursor-default items-center justify-center">
                                                <ChevronUp className="size-4" />
                                            </Select.ScrollUpButton>
                                            <Select.Viewport className="p-1 min-w-(--radix-select-trigger-width)">
                                                {authSchemes.map((auth, index) => (
                                                    <Select.Item
                                                        key={getAuthSchemeValue(index)}
                                                        value={getAuthSchemeValue(index)}
                                                        className={cn(
                                                            "relative flex h-8 select-none items-center rounded-1 pl-8 pr-2 text-sm outline-none",
                                                            "cursor-pointer data-[highlighted]:bg-(color:--grayscale-a3) text-(color:--grayscale-a12)"
                                                        )}
                                                    >
                                                        <Select.ItemText>
                                                            {getAuthSchemeLabel(auth, lang)}
                                                        </Select.ItemText>
                                                        <Select.ItemIndicator className="absolute left-2 inline-flex items-center justify-center">
                                                            <Check className="size-4" />
                                                        </Select.ItemIndicator>
                                                    </Select.Item>
                                                ))}
                                            </Select.Viewport>
                                            <Select.ScrollDownButton className="flex h-6 cursor-default items-center justify-center">
                                                <ChevronDown className="size-4" />
                                            </Select.ScrollDownButton>
                                        </Select.Content>
                                    </Select.Portal>
                                </Select.Root>
                            </div>
                        )}
                        {visitDiscriminatedUnion(selectedAuth)._visit({
                            bearerAuth: () => <BearerAuthFields label={t(lang).auth.bearerToken} lang={lang} />,
                            basicAuth: () => <BasicAuthFields lang={lang} />,
                            header: (header) => <HeaderAuthFields header={header} lang={lang} />,
                            oAuth: () => <BearerAuthFields label={t(lang).auth.oauthToken} lang={lang} />,
                            _other: () => null
                        })}
                    </div>
                </div>
            </FernCollapse>
        </section>
    );
}

function BearerAuthFields({ label = "Bearer Token", lang }: { label?: string; lang: string }) {
    const [bearerAuth, setBearerAuth] = useAtom(PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM);

    return (
        <div className="space-y-2">
            <label className="text-text-secondary text-xs font-medium">{label}</label>
            <PasswordInputGroup
                value={bearerAuth.token}
                onValueChange={(value) => setBearerAuth({ token: value })}
                placeholder="Enter token..."
                className="font-mono"
                lang={lang}
            />
        </div>
    );
}

function BasicAuthFields({ lang }: { lang: string }) {
    const [username, setUsername] = useAtom(PLAYGROUND_AUTH_STATE_BASIC_AUTH_USERNAME_ATOM);
    const [password, setPassword] = useAtom(PLAYGROUND_AUTH_STATE_BASIC_AUTH_PASSWORD_ATOM);

    return (
        <>
            <div className="space-y-2">
                <label className="text-text-secondary text-xs font-medium">{t(lang).auth.username}</label>
                <FernInput
                    value={username}
                    onValueChange={setUsername}
                    placeholder={t(lang).auth.enterUsername}
                    className="font-mono"
                    lang={lang}
                />
            </div>
            <div className="space-y-2">
                <label className="text-text-secondary text-xs font-medium">{t(lang).auth.password}</label>
                <PasswordInputGroup
                    value={password}
                    onValueChange={setPassword}
                    placeholder={t(lang).auth.enterPassword}
                    className="font-mono"
                    lang={lang}
                />
            </div>
        </>
    );
}

function HeaderAuthFields({ header, lang }: { header: Extract<AuthScheme, { type: "header" }>; lang: string }) {
    const [headerAuth, setHeaderAuth] = useAtom(PLAYGROUND_AUTH_STATE_HEADER_ATOM);
    const headerValue = headerAuth.headers[header.headerWireValue] ?? "";

    return (
        <div className="space-y-2">
            <label className="text-text-secondary text-xs font-medium">
                {header.headerWireValue}
                {header.prefix && (
                    <span className="text-text-tertiary ml-1">
                        {"("}
                        {t(lang).auth.prefix}
                        {": "}
                        {header.prefix}
                        {")"}
                    </span>
                )}
            </label>
            <PasswordInputGroup
                value={headerValue}
                onValueChange={(value) =>
                    setHeaderAuth({
                        headers: {
                            ...headerAuth.headers,
                            [header.headerWireValue]: value
                        }
                    })
                }
                placeholder={t(lang).auth.enterValue}
                className="font-mono"
                lang={lang}
            />
        </div>
    );
}
