"use client";

import type { DocsSiteUrl } from "@fern-api/fdr-sdk/orpc-client";
import { memo } from "react";

import { ExternalHoverLink } from "../ui/ExternalHoverLink";

export declare namespace DocsSiteLink {
    export interface Props {
        docsSiteUrl: DocsSiteUrl;
    }
}

export const DocsSiteLink = memo(function DocsSiteLink({ docsSiteUrl }: DocsSiteLink.Props) {
    const { domain, path } = docsSiteUrl;

    return (
        <ExternalHoverLink
            href={new URL(path ?? "", `https://${domain}`).toString()}
            displayHref={`${domain}${path ?? ""}`}
        />
    );
});
