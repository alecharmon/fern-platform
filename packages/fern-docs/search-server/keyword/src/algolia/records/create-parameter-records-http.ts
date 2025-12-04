import type { ApiDefinition } from "@fern-api/fdr-sdk";

import type { EndpointBaseRecord, ParameterRecord } from "../types";
import { createParameterRecord, extractBodyProperties, extractErrorBodyProperties } from "./create-parameter-records";

export interface CreateHttpParameterRecordsOptions {
    endpointBase: EndpointBaseRecord;
    endpoint: ApiDefinition.EndpointDefinition;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function createHttpParameterRecords({
    endpointBase,
    endpoint,
    types
}: CreateHttpParameterRecordsOptions): ParameterRecord[] {
    const records: ParameterRecord[] = [];
    let position = 2;

    endpoint.pathParameters?.forEach((param) => {
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

    endpoint.queryParameters?.forEach((param) => {
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

    endpoint.requestHeaders?.forEach((param) => {
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

    endpoint.responseHeaders?.forEach((param) => {
        records.push(
            createParameterRecord({
                endpointBase,
                property: param,
                section_type: "response",
                subsection_type: "header",
                types,
                page_position: position++
            })
        );
    });

    const requestBody = endpoint.requests?.[0]?.body;
    if (requestBody) {
        const bodyProperties = extractBodyProperties(requestBody, types, 2);
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

    const responseBody = endpoint.responses?.[0]?.body;
    if (responseBody) {
        const bodyProperties = extractBodyProperties(responseBody, types, 2);
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

    endpoint.errors?.forEach((error) => {
        const statusCode = error.statusCode.toString();
        const errorProperties = extractErrorBodyProperties(error.shape, types, 2);
        errorProperties.forEach(({ property, breadcrumb }) => {
            records.push(
                createParameterRecord({
                    endpointBase,
                    property,
                    section_type: "response",
                    subsection_type: "body",
                    status_code: statusCode,
                    breadcrumb,
                    types,
                    page_position: position++
                })
            );
        });
    });

    return records;
}
