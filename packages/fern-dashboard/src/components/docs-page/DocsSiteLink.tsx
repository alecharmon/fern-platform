"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { memo } from "react";

import { ExternalHoverLink } from "../ui/ExternalHoverLink";

export declare namespace DocsSiteLink {
    export interface Props {
        docsSiteUrl: FdrAPI.dashboard.DocsSiteUrl;
    }
}

export const DocsSiteLink = memo(function DocsSiteLink({ docsSiteUrl }: DocsSiteLink.Props) {
    const { domain, path } = docsSiteUrl;

    return (
        <ExternalHoverLink
            href={new URL(path ?? "", `https://${domain}`).toString()}
            displayHref={`${domain}${path}`}
        />
    );
});
