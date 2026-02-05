"use client";

import { conformExplorerRoute } from "@fern-api/docs-utils";
import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { cn } from "@fern-docs/components/cn";
import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { Play } from "lucide-react";
import type { FC } from "react";

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

    if (!shouldShowPlayground(state, endpoint)) {
        return null;
    }

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
                <ButtonLink
                    id={`playground-button:${state.slug}`}
                    aria-description={
                        playgroundSettings?.button?.href
                            ? t(lang).apiReference.opensApiExplorerNewTab
                            : t(lang).apiReference.opensApiExplorer
                    }
                    href={playgroundSettings?.button?.href ?? conformExplorerRoute(state.slug)}
                    target={playgroundSettings?.button?.href ? "_blank" : undefined}
                    variant="default"
                    size="xs"
                    className={cn("font-mono [&_svg]:size-3", className)}
                    scroll={false}
                >
                    <Play className="fill-current" />
                    {t(lang).buttons.tryIt}
                </ButtonLink>
            </FernTooltip>
        </FernTooltipProvider>
    );
};
