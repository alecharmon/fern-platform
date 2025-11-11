"use client";

import { removeTrailingSlash } from "@fern-api/docs-utils";
import {
    type ExampleWebSocketSession,
    toColonEndpointPathLiteral,
    type WebSocketChannel
} from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";

export function HandshakeExample({
    channel,
    example,
    lang
}: {
    channel: WebSocketChannel;
    example: ExampleWebSocketSession | undefined;
    lang: string;
}) {
    const [baseUrl] = usePlaygroundBaseUrl(channel);

    return (
        <div className="flex px-1 py-3">
            <table className="text-body min-w-0 flex-1 shrink table-fixed border-separate border-spacing-x-2 whitespace-normal break-words font-mono text-sm">
                <tbody>
                    <tr>
                        <td className="text-left align-top">{t(lang).apiReference.url}</td>
                        <td className="text-left align-top">
                            {`${removeTrailingSlash(baseUrl ?? "")}${example?.path ?? toColonEndpointPathLiteral(channel.path)}`}
                        </td>
                    </tr>
                    <tr>
                        <td className="text-left align-top">{t(lang).apiReference.method}</td>
                        <td className="text-left align-top">{t(lang).httpMethods.get}</td>
                    </tr>
                    <tr>
                        <td className="text-left align-top">{t(lang).apiReference.status}</td>
                        <td className="text-left align-top">{t(lang).status.switchingProtocols}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
