"use client";

import type { APIV1Read } from "@fern-api/fdr-sdk";
import type { EndpointContext, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import { Button } from "@fern-docs/components/button";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { t } from "@fern-docs/i18n";
import { noop } from "es-toolkit/function";
import { useAtom, useSetAtom } from "jotai";
import { RESET } from "jotai/utils";
import React, { useEffect, useRef } from "react";
import { useApiKeyInjectionConfig, useInjectedApiKey } from "@/components/services/useApiKeyInjectionConfig";
import {
    PLAYGROUND_AUTH_FORM_OPEN_ATOM,
    PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM,
    PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM,
    PLAYGROUND_AUTH_STATE_HEADER_ATOM,
    PLAYGROUND_AUTH_STATE_OAUTH_ATOM,
    useResolvedPlaygroundState
} from "@/state/playground";
import { getAuthKey } from "../utils";
import { PlaygroundCardTriggerApiKeyInjected } from "./PlaygroundCardTriggerApiKeyInjected";
import { PlaygroundCardTriggerManual } from "./PlaygroundCardTriggerManual";

const PlaygroundAuthorizationFormCardCtx = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    toggleOpen: () => void;
    resetForm: () => void;
    apiKey: string | null;
    authIndex: number;
    auth: APIV1Read.ApiAuth | null;
    totalAuthCount: number;
    allAuths: APIV1Read.ApiAuth[];
}>({
    open: false,
    setOpen: noop,
    toggleOpen: noop,
    resetForm: noop,
    apiKey: null,
    authIndex: 0,
    auth: null,
    totalAuthCount: 1,
    allAuths: []
});

export function PlaygroundAuthorizationFormCardRoot({
    children,
    authIndex = 0,
    auth,
    totalAuthCount = 1,
    allAuthTypes = [],
    allAuths = [],
    authGroupSchemes = []
}: {
    children: React.ReactNode;
    authIndex?: number;
    auth: APIV1Read.ApiAuth;
    totalAuthCount?: number;
    allAuthTypes?: string[];
    allAuths?: APIV1Read.ApiAuth[];
    authGroupSchemes?: APIV1Read.ApiAuth[];
}) {
    const [open, setOpen] = useAtom(PLAYGROUND_AUTH_FORM_OPEN_ATOM);

    const [bearerAuth, setBearerAuth] = useAtom(PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM);
    const setBearerAuthAtom = useSetAtom(PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM);
    const setBasicAuth = useSetAtom(PLAYGROUND_AUTH_STATE_BASIC_AUTH_ATOM);
    const setHeaderAuth = useSetAtom(PLAYGROUND_AUTH_STATE_HEADER_ATOM);
    const setOAuth = useSetAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);
    const apiKey = useInjectedApiKey();
    const resolvedState = useResolvedPlaygroundState();
    const prevTokenRef = useRef<string | undefined>(resolvedState?.auth?.bearer_token);

    const handleResetAuth = () => {
        const schemesToReset = authGroupSchemes.length > 0 ? authGroupSchemes : [auth];

        const hasBearer = schemesToReset.some((scheme) => scheme.type === "bearerAuth");
        const hasBasic = schemesToReset.some((scheme) => scheme.type === "basicAuth");
        const hasHeader = schemesToReset.some((scheme) => scheme.type === "header");
        const hasOAuth = schemesToReset.some((scheme) => scheme.type === "oAuth");

        if (hasBearer) {
            setBearerAuthAtom({ token: resolvedState?.auth?.bearer_token ?? apiKey ?? "" });
            setOAuth((prev) => ({ ...prev, userSuppliedAccessToken: "" }));
        }
        if (hasBasic) {
            setBasicAuth(RESET);
        }
        if (hasHeader) {
            setHeaderAuth(RESET);
        }
        if (hasOAuth) {
            setOAuth(RESET);
        }
    };

    // Only update bearer auth when the resolved environment value actually changes
    // Don't overwrite user-entered values on mount
    useEffect(() => {
        const currentToken = resolvedState?.auth?.bearer_token;
        if (currentToken !== undefined && currentToken !== prevTokenRef.current) {
            setBearerAuth({ token: currentToken });
            prevTokenRef.current = currentToken;
        }
    }, [resolvedState?.auth?.bearer_token, setBearerAuth]);

    return (
        <PlaygroundAuthorizationFormCardCtx.Provider
            value={{
                open,
                setOpen,
                toggleOpen: () => setOpen((prev) => !prev),
                resetForm: handleResetAuth,
                apiKey: bearerAuth.token ?? "",
                authIndex,
                auth,
                totalAuthCount,
                allAuths
            }}
        >
            <div className="relative">{children}</div>
        </PlaygroundAuthorizationFormCardCtx.Provider>
    );
}

export function usePlaygroundAuthorizationFormCard() {
    return React.useContext(PlaygroundAuthorizationFormCardCtx);
}

export function PlaygroundAuthorizationCardTrigger({
    auth,
    disabled,
    context,
    oauthReferencedContext,
    lang,
    allAuths
}: {
    auth: APIV1Read.ApiAuth;
    disabled: boolean;
    context: EndpointContext | WebSocketContext;
    oauthReferencedContext?: EndpointContext;
    lang: string;
    allAuths?: APIV1Read.ApiAuth[];
}) {
    const { open, toggleOpen, allAuths: contextAllAuths } = usePlaygroundAuthorizationFormCard();
    const apiKeyInjection = useApiKeyInjectionConfig();
    const authsToUse = allAuths || contextAllAuths;

    const currentAuthWithKey = context.authsWithKeys.find((a) => a.scheme === auth);
    const authKey = currentAuthWithKey ? getAuthKey(currentAuthWithKey) : "unknown";

    return apiKeyInjection.enabled ? (
        <PlaygroundCardTriggerApiKeyInjected
            auth={auth}
            authKey={authKey}
            config={apiKeyInjection}
            context={context}
            oauthReferencedContext={oauthReferencedContext}
            disabled={disabled}
            toggleOpen={toggleOpen}
            lang={lang}
            allAuths={authsToUse}
        />
    ) : (
        <PlaygroundCardTriggerManual
            auth={auth}
            disabled={disabled}
            isOpen={open}
            toggleOpen={toggleOpen}
            lang={lang}
            allAuthsWithKeys={context.authsWithKeys}
            allAuthOptionEntries={context.authOptionEntries}
        />
    );
}

export function PlaygroundAuthorizationFormCardContent({ children }: { children: React.ReactNode }) {
    const { open } = usePlaygroundAuthorizationFormCard();
    return (
        <FernCollapse open={open}>
            <div className="pt-4">{children}</div>
        </FernCollapse>
    );
}

export function useClosePlaygroundAuthorizationFormCard() {
    const { setOpen } = usePlaygroundAuthorizationFormCard();
    return () => setOpen(false);
}

export function PlaygroundAuthorizationFormCardResetButton({ lang }: { lang: string }) {
    const { apiKey, resetForm } = usePlaygroundAuthorizationFormCard();
    if (apiKey == null) {
        return null;
    }
    return (
        <Button onClick={resetForm} variant="outline">
            {t(lang).buttons.resetTokenToDefault}
        </Button>
    );
}

export function PlaygroundAuthorizationFormCardCloseButton({ lang }: { lang: string }) {
    const { setOpen } = usePlaygroundAuthorizationFormCard();
    return (
        <Button onClick={() => setOpen(false)} variant="outline">
            {t(lang).buttons.close}
        </Button>
    );
}
