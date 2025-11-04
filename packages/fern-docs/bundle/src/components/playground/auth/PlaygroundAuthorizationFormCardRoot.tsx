"use client";

import type { APIV1Read } from "@fern-api/fdr-sdk";
import { Button } from "@fern-docs/components/button";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { t } from "@fern-docs/i18n";
import { useBooleanState } from "@fern-ui/react-commons";
import { noop } from "es-toolkit/function";
import { useAtom, useSetAtom } from "jotai";
import React, { useEffect, useRef } from "react";
import { useApiKeyInjectionConfig, useInjectedApiKey } from "@/components/services/useApiKeyInjectionConfig";
import {
    PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM,
    PLAYGROUND_AUTH_STATE_OAUTH_ATOM,
    useResolvedPlaygroundState
} from "@/state/playground";
import { PlaygroundCardTriggerApiKeyInjected } from "./PlaygroundCardTriggerApiKeyInjected";
import { PlaygroundCardTriggerManual } from "./PlaygroundCardTriggerManual";

const PlaygroundAuthorizationFormCardCtx = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    toggleOpen: () => void;
    resetForm: () => void;
    apiKey: string | null;
}>({
    open: false,
    setOpen: noop,
    toggleOpen: noop,
    resetForm: noop,
    apiKey: null
});

export function PlaygroundAuthorizationFormCardRoot({ children }: { children: React.ReactNode }) {
    const openState = useBooleanState(false);

    const [bearerAuth, setBearerAuth] = useAtom(PLAYGROUND_AUTH_STATE_BEARER_TOKEN_ATOM);
    const setOAuth = useSetAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);
    const apiKey = useInjectedApiKey();
    const resolvedState = useResolvedPlaygroundState();
    const prevTokenRef = useRef<string | undefined>(resolvedState?.auth?.bearer_token);

    const handleResetBearerAuth = () => {
        setBearerAuth({ token: resolvedState?.auth?.bearer_token ?? apiKey ?? "" });
        setOAuth((prev) => ({ ...prev, userSuppliedAccessToken: "" }));
    };

    // only update bearer auth if the resolved environment value actually changes
    useEffect(() => {
        const currentToken = resolvedState?.auth?.bearer_token;
        if (currentToken && currentToken !== prevTokenRef.current) {
            setBearerAuth({ token: currentToken });
            prevTokenRef.current = currentToken;
        }
    }, [resolvedState?.auth?.bearer_token, setBearerAuth]);

    return (
        <PlaygroundAuthorizationFormCardCtx.Provider
            value={{
                open: openState.value,
                setOpen: openState.setValue,
                toggleOpen: openState.toggleValue,
                resetForm: handleResetBearerAuth,
                apiKey: bearerAuth.token ?? ""
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
    lang
}: {
    auth: APIV1Read.ApiAuth;
    disabled: boolean;
    lang: string;
}) {
    const { open, toggleOpen, setOpen } = usePlaygroundAuthorizationFormCard();
    const apiKeyInjection = useApiKeyInjectionConfig();
    return apiKeyInjection.enabled ? (
        <PlaygroundCardTriggerApiKeyInjected
            auth={auth}
            config={apiKeyInjection}
            disabled={disabled}
            toggleOpen={toggleOpen}
            onClose={() => setOpen(false)}
            lang={lang}
        />
    ) : (
        <PlaygroundCardTriggerManual
            auth={auth}
            disabled={disabled}
            isOpen={open}
            toggleOpen={toggleOpen}
            lang={lang}
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
