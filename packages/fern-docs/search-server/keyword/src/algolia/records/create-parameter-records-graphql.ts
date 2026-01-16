import { type ApiDefinition, FdrAPI } from "@fern-api/fdr-sdk";

import type { EndpointBaseRecord, ParameterRecord } from "../types";
import { createParameterRecord, extractObjectPropertiesFromShape } from "./create-parameter-records";

export interface CreateGraphQlParameterRecordsOptions {
    endpointBase: EndpointBaseRecord;
    graphqlOperation: ApiDefinition.GraphQlOperation;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function createGraphQlParameterRecords({
    endpointBase,
    graphqlOperation,
    types
}: CreateGraphQlParameterRecordsOptions): ParameterRecord[] {
    const records: ParameterRecord[] = [];
    let position = 2;

    // Process arguments as request parameters
    graphqlOperation.arguments?.forEach((arg) => {
        const argProperty: ApiDefinition.ObjectProperty = {
            key: FdrAPI.PropertyKey(arg.name),
            valueShape: arg.type,
            description: arg.description,
            availability: arg.availability,
            propertyAccess: undefined
        };

        records.push(
            createParameterRecord({
                endpointBase,
                property: argProperty,
                section_type: "request",
                subsection_type: "body",
                types,
                page_position: position++
            })
        );

        // Extract nested properties from argument types
        const nestedProperties = extractObjectPropertiesFromShape(arg.type, types, 15, 0, [
            {
                key: arg.name,
                display_name: arg.name,
                optional: isTypeOptional(arg.type)
            }
        ]);
        nestedProperties.forEach(({ property, breadcrumb }) => {
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
    });

    // Process return type as response parameters
    const returnTypeProperties = extractObjectPropertiesFromShape(graphqlOperation.returnType, types, 15);
    returnTypeProperties.forEach(({ property, breadcrumb }) => {
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

    return records;
}

function isTypeOptional(shape: ApiDefinition.TypeShapeOrReference): boolean {
    if ("type" in shape) {
        return shape.type === "optional" || shape.type === "nullable";
    }
    return false;
}
