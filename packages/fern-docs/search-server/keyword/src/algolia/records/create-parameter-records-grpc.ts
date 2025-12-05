import type { ApiDefinition } from "@fern-api/fdr-sdk";

import type { EndpointBaseRecord, ParameterRecord } from "../types";
import { createParameterRecord, extractBodyProperties } from "./create-parameter-records";

export interface CreateGrpcParameterRecordsOptions {
    endpointBase: EndpointBaseRecord;
    grpc: ApiDefinition.EndpointDefinition;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function createGrpcParameterRecords({
    endpointBase,
    grpc,
    types
}: CreateGrpcParameterRecordsOptions): ParameterRecord[] {
    const records: ParameterRecord[] = [];
    let position = 2;

    const requestBody = grpc.requests?.[0]?.body;
    if (requestBody) {
        const bodyProperties = extractBodyProperties(requestBody, types, 15);
        bodyProperties.forEach(({ property, breadcrumb }) => {
            records.push(
                createParameterRecord({
                    endpointBase,
                    property,
                    section_type: "request",
                    subsection_type: "body",
                    breadcrumb,
                    types,
                    page_position: position++
                })
            );
        });
    }

    const responseBody = grpc.responses?.[0]?.body;
    if (responseBody) {
        const bodyProperties = extractBodyProperties(responseBody, types, 15);
        bodyProperties.forEach(({ property, breadcrumb }) => {
            records.push(
                createParameterRecord({
                    endpointBase,
                    property,
                    section_type: "response",
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
