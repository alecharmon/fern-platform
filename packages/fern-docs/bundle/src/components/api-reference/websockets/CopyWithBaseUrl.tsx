"use client";

import { removeTrailingSlash } from "@fern-api/docs-utils";
import { toColonEndpointPathLiteral, type WebSocketChannel } from "@fern-api/fdr-sdk/api-definition";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";

import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";

export function CopyWithBaseUrl({ channel, lang }: { channel: WebSocketChannel; lang: string }) {
    const [baseUrl] = usePlaygroundBaseUrl(channel);
    return (
        <CopyToClipboardButton
            className="-mr-1"
            content={() => `${removeTrailingSlash(baseUrl ?? "")}${toColonEndpointPathLiteral(channel.path)}`}
            lang={lang}
        />
    );
}
