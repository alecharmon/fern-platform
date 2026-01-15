import type { ApiDefinition } from "@fern-api/fdr-sdk";

import type { EndpointBaseRecord, ParameterRecord } from "../types";
import { createParameterRecord, extractWebhookPayloadProperties } from "./create-parameter-records";

export interface CreateWebhookParameterRecordsOptions {
    endpointBase: EndpointBaseRecord;
    webhook: ApiDefinition.WebhookDefinition;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function createWebhookParameterRecords({
    endpointBase,
    webhook,
    types
}: CreateWebhookParameterRecordsOptions): ParameterRecord[] {
    const records: ParameterRecord[] = [];
    let position = 2;

    webhook.headers?.forEach((param) => {
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

    const payload = webhook.payloads?.[0];
    if (payload?.shape) {
        const payloadProperties = extractWebhookPayloadProperties(payload.shape, types, 15);
        payloadProperties.forEach(({ property, breadcrumb }) => {
            records.push(
                createParameterRecord({
                    endpointBase,
                    property,
                    section_type: "payload",
                    subsection_type: "body",
                    breadcrumb,
                    types,
                    page_position: position++
                })
            );
        });
    }

    return records;
}
