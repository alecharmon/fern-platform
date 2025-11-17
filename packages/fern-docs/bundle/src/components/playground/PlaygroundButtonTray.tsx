"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { FC } from "react";

import { PlaygroundButton } from "./PlaygroundButton";

export const PlaygroundButtonTray: FC<{
    state: FernNavigation.EndpointNode | FernNavigation.WebSocketNode;
    endpoint?: ApiDefinition.EndpointDefinition | ApiDefinition.WebSocketChannel;
    className?: string;
    lang: string;
}> = ({ state, endpoint, className, lang }) => {
    if (state.playground?.hidden) {
        return null;
    }
    return (
        <div className="bg-(color:--grayscale-a2) border-card-border flex h-10 justify-end border-t p-2">
            <div className="flex items-center">
                <PlaygroundButton state={state} endpoint={endpoint} className={className} lang={lang} />
            </div>
        </div>
    );
};
