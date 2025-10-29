"use client";

import { removeTrailingSlash } from "@fern-api/docs-utils";
import {
    type ExampleWebSocketSession,
    toColonEndpointPathLiteral,
    type WebSocketChannel
} from "@fern-api/fdr-sdk/api-definition";
import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";
import { i18n } from "@/constants";

export function HandshakeExample({
    channel,
    example
}: {
    channel: WebSocketChannel;
    example: ExampleWebSocketSession | undefined;
}) {
    const [baseUrl] = usePlaygroundBaseUrl(channel);

    return (
        <div className="flex px-1 py-3">
            <table className="text-body min-w-0 flex-1 shrink table-fixed border-separate border-spacing-x-2 whitespace-normal break-words font-mono text-sm">
                <tbody>
                    <tr>
                        <td className="text-left align-top">{i18n.apiReference.url}</td>
                        <td className="text-left align-top">
                            {`${removeTrailingSlash(baseUrl ?? "")}${example?.path ?? toColonEndpointPathLiteral(channel.path)}`}
                        </td>
                    </tr>
                    <tr>
                        <td className="text-left align-top">{i18n.apiReference.method}</td>
                        <td className="text-left align-top">{i18n.httpMethods.get}</td>
                    </tr>
                    <tr>
                        <td className="text-left align-top">{i18n.apiReference.status}</td>
                        <td className="text-left align-top">101 Switching Protocols</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
