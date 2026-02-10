"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { cn } from "@fern-docs/components/cn";
import { Button } from "@fern-docs/components/FernButtonV2";
import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { useSetAtom } from "jotai";
import { Play } from "lucide-react";
import { type FC, useCallback } from "react";
import { useUrlParams } from "@/hooks/use-url-params";
import { PLAYGROUND_EXPLORER_OPEN_ATOM } from "@/state/playground";

function isEndpointDefinition(
    endpoint: ApiDefinition.EndpointDefinition | ApiDefinition.WebSocketChannel | undefined
): endpoint is ApiDefinition.EndpointDefinition {
    return !!endpoint && "method" in endpoint;
}

function shouldShowPlayground(
    state: FernNavigation.NavigationNodeApiLeaf,
    endpoint?: ApiDefinition.EndpointDefinition | ApiDefinition.WebSocketChannel
): boolean {
    if (state.type === "webhook" || state.type === "grpc") {
        return false;
    }

    if (state.type === "endpoint") {
        if (!isEndpointDefinition(endpoint)) {
            return true;
        }
        return endpoint.includeInApiExplorer ?? true;
    }

    if (state.type === "webSocket") {
        return true;
    }

    return true;
}

export const PlaygroundButton: FC<{
    state: FernNavigation.NavigationNodeApiLeaf;
    endpoint?: ApiDefinition.EndpointDefinition | ApiDefinition.WebSocketChannel;
    className?: string;
    lang: string;
}> = ({ state, endpoint, className, lang }) => {
    const playgroundSettings = state.type === "endpoint" || state.type === "webSocket" ? state.playground : undefined;
    const { addUrlParamToPathname } = useUrlParams();
    const setExplorerOpen = useSetAtom(PLAYGROUND_EXPLORER_OPEN_ATOM);

    const handleOpen = useCallback(() => {
        setExplorerOpen(true);
        const url = addUrlParamToPathname("explorer", "true");
        window.history.pushState(window.history.state, "", url);
    }, [setExplorerOpen, addUrlParamToPathname]);

    if (!shouldShowPlayground(state, endpoint)) {
        return null;
    }

    const hasCustomHref = playgroundSettings?.button?.href != null;

    return (
        <FernTooltipProvider>
            <FernTooltip
                content={
                    <span>
                        {t(lang).apiReference.customizeAndRunIn}
                        <span className="text-(color:--accent-a11) font-semibold">
                            {t(lang).apiReference.apiExplorer}
                        </span>
                    </span>
                }
            >
                {hasCustomHref ? (
                    <ButtonLink
                        id={`playground-button:${state.slug}`}
                        aria-description={t(lang).apiReference.opensApiExplorerNewTab}
                        href={playgroundSettings.button!.href!}
                        target="_blank"
                        variant="default"
                        size="xs"
                        className={cn("font-mono [&_svg]:size-3", className)}
                        scroll={false}
                    >
                        <Play className="fill-current" />
                        {t(lang).buttons.tryIt}
                    </ButtonLink>
                ) : (
                    <Button
                        id={`playground-button:${state.slug}`}
                        aria-description={t(lang).apiReference.opensApiExplorer}
                        onClick={handleOpen}
                        variant="default"
                        size="xs"
                        className={cn("font-mono [&_svg]:size-3", className)}
                    >
                        <Play className="fill-current" />
                        {t(lang).buttons.tryIt}
                    </Button>
                )}
            </FernTooltip>
        </FernTooltipProvider>
    );
};
