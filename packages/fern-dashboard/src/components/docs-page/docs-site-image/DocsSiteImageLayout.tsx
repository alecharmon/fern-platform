"use client";

import type { DocsSiteUrl } from "@fern-api/fdr-sdk/orpc-client";
import { ExternalLink } from "lucide-react";
import type React from "react";

import { HOMEPAGE_SCREENSHOT_HEIGHT, HOMEPAGE_SCREENSHOT_WIDTH } from "@/app/api/homepage-images/constants";

export declare namespace DocsSiteImageLayout {
    export interface Props {
        children: React.JSX.Element;
        docsUrl?: DocsSiteUrl;
    }
}

export function DocsSiteImageLayout({ children, docsUrl }: DocsSiteImageLayout.Props) {
    const { domain, path } = docsUrl ?? {};

    const commonProps = {
        className:
            "border-border group relative flex shrink-0 overflow-hidden rounded-lg border md:w-[40%] md:min-w-[150px] md:max-w-[400px]",
        style: {
            aspectRatio: `${HOMEPAGE_SCREENSHOT_WIDTH} / ${HOMEPAGE_SCREENSHOT_HEIGHT}`
        }
    };

    const hoverOverlay = (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-gray-200/30 opacity-0 backdrop-blur-none transition-all duration-500 group-hover:opacity-100 group-hover:backdrop-blur-xs dark:bg-black/50">
            <span className="text-black font-medium dark:text-white">Visit site</span>
            <ExternalLink className="size-4 text-black dark:text-white" />
        </div>
    );

    if (domain) {
        const href = new URL(path ?? "/", `https://${domain}`).toString();
        return (
            <a {...commonProps} href={href} target="_blank" rel="noopener noreferrer">
                {children}
                {hoverOverlay}
            </a>
        );
    }

    return <div {...commonProps}>{children}</div>;
}
