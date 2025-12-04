import type { ApiDefinition } from "@fern-api/fdr-sdk";

import type { EndpointBaseRecord, ParameterRecord } from "../types";
import { createParameterRecord, extractObjectPropertiesFromShape } from "./create-parameter-records";

export interface CreateWebSocketParameterRecordsOptions {
    endpointBase: EndpointBaseRecord;
    webSocket: ApiDefinition.WebSocketChannel;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function createWebSocketParameterRecords({
    endpointBase,
    webSocket,
    types
}: CreateWebSocketParameterRecordsOptions): ParameterRecord[] {
    const records: ParameterRecord[] = [];
    let position = 2;

    webSocket.pathParameters?.forEach((param) => {
        records.push(
            createParameterRecord({
                endpointBase,
                property: param,
                section_type: "request",
                subsection_type: "path",
                types,
                page_position: position++
            })
        );
    });

    webSocket.queryParameters?.forEach((param) => {
        records.push(
            createParameterRecord({
                endpointBase,
                property: param,
                section_type: "request",
                subsection_type: "query",
                types,
                page_position: position++
            })
        );
    });

    webSocket.requestHeaders?.forEach((param) => {
        records.push(
            createParameterRecord({
                endpointBase,
                property: param,
                section_type: "request",
                subsection_type: "header",
                types,
                page_position: position++
            })
        );
    });

    for (const message of webSocket.messages) {
        const origin = message.origin as "client" | "server";
        const section_type = origin === "client" ? "request" : "response";

        const messageProperties = extractObjectPropertiesFromShape(message.body, types, 2);
        messageProperties.forEach(({ property, breadcrumb }) => {
            records.push(
                createParameterRecord({
                    endpointBase,
                    property,
                    section_type,
                    subsection_type: "body",
                    breadcrumb,
                    types,
                    websocket_origin: origin,
                    page_position: position++
                })
            );
        });
    }

    return records;
}
