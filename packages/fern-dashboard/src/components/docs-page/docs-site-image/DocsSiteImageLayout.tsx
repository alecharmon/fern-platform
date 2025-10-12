"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import type React from "react";

import { HOMEPAGE_SCREENSHOT_HEIGHT, HOMEPAGE_SCREENSHOT_WIDTH } from "@/app/api/homepage-images/constants";

export declare namespace DocsSiteImageLayout {
    export interface Props {
        children: React.JSX.Element;
        docsUrl?: FdrAPI.dashboard.DocsSiteUrl;
    }
}

export function DocsSiteImageLayout({ children, docsUrl }: DocsSiteImageLayout.Props) {
    const { domain, path } = docsUrl ?? {};

    const commonProps = {
        className:
            "border-border relative flex shrink-0 overflow-hidden rounded-lg border md:w-[40%] md:min-w-[150px] md:max-w-[400px]",
        style: {
            aspectRatio: `${HOMEPAGE_SCREENSHOT_WIDTH} / ${HOMEPAGE_SCREENSHOT_HEIGHT}`
        }
    };

    if (path && domain) {
        return (
            <a {...commonProps} href={new URL(path, `https://${domain}`).toString()}>
                {children}
            </a>
        );
    }

    return <div {...commonProps}>{children}</div>;
}
