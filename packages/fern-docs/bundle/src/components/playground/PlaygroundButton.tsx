"use client";

import { conformExplorerRoute } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { cn } from "@fern-docs/components/cn";
import { ButtonLink } from "@fern-docs/components/FernLinkButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { Play } from "lucide-react";
import type { FC } from "react";

import { i18n } from "@/constants";
import { usePlaygroundSettings } from "../hooks/usePlaygroundSettings";

export const PlaygroundButton: FC<{
    state: FernNavigation.NavigationNodeApiLeaf;
    className?: string;
}> = ({ state, className }) => {
    const settings = usePlaygroundSettings(state.id);

    return (
        <FernTooltipProvider>
            <FernTooltip
                content={
                    <span>
                        {i18n.apiReference.customizeAndRunIn}
                        <span className="text-(color:--accent-a11) font-semibold">{i18n.apiReference.apiExplorer}</span>
                    </span>
                }
            >
                <ButtonLink
                    id={`playground-button:${state.slug}`}
                    aria-description={
                        settings?.button?.href
                            ? i18n.apiReference.opensApiExplorerNewTab
                            : i18n.apiReference.opensApiExplorer
                    }
                    href={settings?.button?.href ?? conformExplorerRoute(state.slug)}
                    target={settings?.button?.href ? "_blank" : undefined}
                    variant="default"
                    size="xs"
                    className={cn("font-mono [&_svg]:size-3", className)}
                    scroll={false}
                >
                    <Play className="fill-current" />
                    {i18n.buttons.tryIt}
                </ButtonLink>
            </FernTooltip>
        </FernTooltipProvider>
    );
};
