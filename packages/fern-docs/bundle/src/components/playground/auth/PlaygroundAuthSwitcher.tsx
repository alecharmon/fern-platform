"use client";

import type { EndpointContext, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import { PlaygroundAuthorizationFormCard } from "./PlaygroundAuthorizationFormCard";

interface PlaygroundAuthSwitcherProps {
    context: EndpointContext | WebSocketContext;
    oauthReferencedContext?: EndpointContext;
    lang: string;
}

export function PlaygroundAuthSwitcher({ context, oauthReferencedContext, lang }: PlaygroundAuthSwitcherProps) {
    if (context.authsWithKeys.length === 0) {
        return null;
    }

    return (
        <PlaygroundAuthorizationFormCard
            context={context}
            oauthReferencedContext={oauthReferencedContext}
            lang={lang}
        />
    );
}
