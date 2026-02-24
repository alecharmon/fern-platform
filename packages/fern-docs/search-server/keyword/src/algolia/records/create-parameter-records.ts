import type { ApiDefinition } from "@fern-api/fdr-sdk";
import { truncateToBytes } from "@fern-api/ui-core-utils";
import { maybePrepareMdxContent, toDescription } from "@fern-docs/search-utils";

import type { EndpointBaseRecord, ParameterRecord } from "../types";

export interface ParameterBreadcrumbItem {
    key: string;
    display_name?: string;
    optional?: boolean;
}

export interface CreateParameterRecordOptions {
    endpointBase: EndpointBaseRecord;
    property: ApiDefinition.ObjectProperty;
    section_type: "request" | "response" | "payload";
    subsection_type: "path" | "query" | "header" | "body";
    status_code?: string;
    breadcrumb?: ParameterBreadcrumbItem[];
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    websocket_origin?: "client" | "server";
    page_position?: number;
}

export function createParameterRecord({
    endpointBase,
    property,
    section_type,
    subsection_type,
    status_code,
    breadcrumb = [],
    types,
    websocket_origin,
    page_position = 2
}: CreateParameterRecordOptions): ParameterRecord {
    const parameterName = property.key;
    const parameterType = getTypeDisplayName(property.valueShape, types);
    const isOptional = isTypeOptional(property.valueShape);
    const prepared = maybePrepareMdxContent(toDescription(property.description ?? undefined));

    const fullBreadcrumb: ParameterBreadcrumbItem[] = [
        ...breadcrumb,
        { key: parameterName, display_name: parameterName, optional: isOptional }
    ];

    const paramPath = fullBreadcrumb.map((b) => b.key).join(".");
    const hashPath = buildHashPath(section_type, subsection_type, paramPath, status_code);
    const objectIdSuffix = buildObjectIdSuffix(section_type, subsection_type, paramPath, status_code, websocket_origin);

    return {
        ...endpointBase,
        objectID: `${endpointBase.objectID}-param-${objectIdSuffix}`,
        type: "parameter",
        title: `${endpointBase.title} - ${parameterName}`,
        hash: hashPath,
        section_type,
        subsection_type,
        status_code,
        websocket_origin,
        parameter_breadcrumb: fullBreadcrumb,
        parameter_name: parameterName,
        parameter_type: parameterType,
        description: prepared.content != null ? truncateToBytes(prepared.content, 50 * 1000) : undefined,
        availability: property.availability ?? undefined,
        page_position,
        keywords: buildParameterKeywords(endpointBase.keywords, parameterName, parameterType)
    };
}

function buildHashPath(
    section_type: "request" | "response" | "payload",
    subsection_type: "path" | "query" | "header" | "body",
    paramPath: string,
    status_code?: string
): string {
    if (status_code) {
        return `#${section_type}.${status_code}.${paramPath}`;
    }
    if (subsection_type === "body") {
        return `#${section_type}.body.${paramPath}`;
    }
    return `#${section_type}.${subsection_type}.${paramPath}`;
}

function buildObjectIdSuffix(
    section_type: "request" | "response" | "payload",
    subsection_type: "path" | "query" | "header" | "body",
    paramPath: string,
    status_code?: string,
    websocket_origin?: "client" | "server"
): string {
    const parts: string[] = [section_type];
    if (websocket_origin) {
        parts.push(websocket_origin);
    }
    if (status_code) {
        parts.push(status_code);
    }
    parts.push(subsection_type, paramPath);
    return parts.join("-");
}

function isTypeOptional(shape: ApiDefinition.TypeShapeOrReference): boolean {
    if ("type" in shape) {
        return shape.type === "optional" || shape.type === "nullable";
    }
    return false;
}

function buildParameterKeywords(
    existingKeywords: string | string[] | undefined,
    parameterName: string,
    parameterType: string | undefined
): string[] {
    const keywords: string[] = existingKeywords
        ? Array.isArray(existingKeywords)
            ? [...existingKeywords]
            : [existingKeywords]
        : [];
    keywords.push("parameter");
    if (parameterType) {
        keywords.push(parameterType);
    }
    return keywords;
}

export function getTypeDisplayName(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): string | undefined {
    if ("type" in shape) {
        switch (shape.type) {
            case "id": {
                const typeDef = types[shape.id];
                return typeDef?.name ?? shape.id;
            }
            case "primitive":
                return getPrimitiveDisplayName(shape.value);
            case "optional":
            case "nullable":
                return getTypeDisplayName(shape.shape, types);
            case "list":
                return `list<${getTypeDisplayName(shape.itemShape, types) ?? "unknown"}>`;
            case "set":
                return `set<${getTypeDisplayName(shape.itemShape, types) ?? "unknown"}>`;
            case "map":
                return `map<${getTypeDisplayName(shape.keyShape, types) ?? "unknown"}, ${getTypeDisplayName(shape.valueShape, types) ?? "unknown"}>`;
            case "literal":
                if (shape.value.type === "stringLiteral") {
                    return `"${shape.value.value}"`;
                }
                return String(shape.value.value);
            case "unknown":
                return "unknown";
            case "alias":
                return getTypeDisplayName(shape.value, types);
            case "enum":
                return "enum";
            case "undiscriminatedUnion":
                return "union";
            case "discriminatedUnion":
                return "union";
            case "object":
                return "object";
        }
    }
    return undefined;
}

function getPrimitiveDisplayName(primitive: ApiDefinition.PrimitiveType): string {
    switch (primitive.type) {
        case "string":
            return "string";
        case "integer":
            return "integer";
        case "long":
            return "long";
        case "double":
            return "double";
        case "boolean":
            return "boolean";
        case "datetime":
            return "datetime";
        case "uuid":
            return "uuid";
        case "base64":
            return "base64";
        case "date":
            return "date";
        case "bigInteger":
            return "bigInteger";
        case "uint":
            return "uint";
        case "uint64":
            return "uint64";
        case "scalar":
            return primitive.name;
    }
}

export interface ExtractedProperty {
    property: ApiDefinition.ObjectProperty;
    breadcrumb: ParameterBreadcrumbItem[];
}

export function extractObjectPropertiesFromShape(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    maxDepth: number = 2,
    currentDepth: number = 0,
    breadcrumb: ParameterBreadcrumbItem[] = [],
    visitedTypeIds: Set<string> = new Set()
): ExtractedProperty[] {
    if (currentDepth >= maxDepth) {
        return [];
    }

    const properties: ExtractedProperty[] = [];

    const resolvedShape = resolveTypeShape(shape, types, visitedTypeIds);
    if (!resolvedShape) {
        return [];
    }

    if (resolvedShape.type === "object") {
        for (const prop of resolvedShape.properties) {
            properties.push({ property: prop, breadcrumb });

            const nestedProperties = extractObjectPropertiesFromShape(
                prop.valueShape,
                types,
                maxDepth,
                currentDepth + 1,
                [
                    ...breadcrumb,
                    {
                        key: prop.key,
                        display_name: prop.key,
                        optional: isTypeOptional(prop.valueShape)
                    }
                ],
                visitedTypeIds
            );
            properties.push(...nestedProperties);
        }
    } else if (resolvedShape.type === "discriminatedUnion") {
        for (const variant of resolvedShape.variants) {
            const variantBreadcrumb: ParameterBreadcrumbItem[] = variant.displayName
                ? [...breadcrumb, { key: variant.displayName, display_name: variant.displayName }]
                : breadcrumb;

            for (const prop of variant.properties) {
                properties.push({ property: prop, breadcrumb: variantBreadcrumb });

                const nestedProperties = extractObjectPropertiesFromShape(
                    prop.valueShape,
                    types,
                    maxDepth,
                    currentDepth + 1,
                    [
                        ...variantBreadcrumb,
                        {
                            key: prop.key,
                            display_name: prop.key,
                            optional: isTypeOptional(prop.valueShape)
                        }
                    ],
                    visitedTypeIds
                );
                properties.push(...nestedProperties);
            }
        }
    } else if (resolvedShape.type === "undiscriminatedUnion") {
        const seenPaths = new Set<string>();
        for (const variant of resolvedShape.variants) {
            const variantBreadcrumb: ParameterBreadcrumbItem[] = variant.displayName
                ? [...breadcrumb, { key: variant.displayName, display_name: variant.displayName }]
                : breadcrumb;

            const variantProperties = extractObjectPropertiesFromShape(
                variant.shape,
                types,
                maxDepth,
                currentDepth + 1,
                variantBreadcrumb,
                visitedTypeIds
            );
            for (const prop of variantProperties) {
                const path = [...prop.breadcrumb.map((b) => b.key), prop.property.key].join(".");
                if (!seenPaths.has(path)) {
                    seenPaths.add(path);
                    properties.push(prop);
                }
            }
        }
    }

    return properties;
}

function resolveTypeShape(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    visitedTypeIds: Set<string> = new Set()
): ApiDefinition.TypeShape | undefined {
    if (!("type" in shape)) {
        return undefined;
    }

    switch (shape.type) {
        case "id": {
            if (visitedTypeIds.has(shape.id)) {
                return undefined;
            }
            visitedTypeIds.add(shape.id);
            const typeDef = types[shape.id];
            if (typeDef) {
                return resolveTypeShape(typeDef.shape, types, visitedTypeIds);
            }
            return undefined;
        }
        case "optional":
        case "nullable":
            return resolveTypeShape(shape.shape, types, visitedTypeIds);
        case "alias":
            return resolveTypeShape(shape.value, types, visitedTypeIds);
        case "object":
        case "enum":
        case "undiscriminatedUnion":
        case "discriminatedUnion":
            return shape;
        default:
            return undefined;
    }
}

export function extractBodyProperties(
    body: ApiDefinition.HttpRequestBodyShape | ApiDefinition.HttpResponseBodyShape,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    maxDepth: number = 2
): ExtractedProperty[] {
    if (body.type === "object") {
        const properties: ExtractedProperty[] = [];
        for (const prop of body.properties) {
            properties.push({ property: prop, breadcrumb: [] });

            const nestedProperties = extractObjectPropertiesFromShape(prop.valueShape, types, maxDepth, 1, [
                {
                    key: prop.key,
                    display_name: prop.key,
                    optional: isTypeOptional(prop.valueShape)
                }
            ]);
            properties.push(...nestedProperties);
        }
        return properties;
    }

    if (body.type === "alias") {
        return extractObjectPropertiesFromShape(body.value, types, maxDepth);
    }

    if (body.type === "formData") {
        const properties: ExtractedProperty[] = [];
        for (const field of body.fields) {
            if (field.type === "property") {
                properties.push({
                    property: {
                        key: field.key,
                        valueShape: field.valueShape,
                        description: field.description,
                        availability: field.availability,
                        propertyAccess: field.propertyAccess
                    },
                    breadcrumb: []
                });
            }
        }
        return properties;
    }

    return [];
}

export function extractErrorBodyProperties(
    shape: ApiDefinition.TypeShape | undefined,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    maxDepth: number = 2
): ExtractedProperty[] {
    if (!shape) {
        return [];
    }

    return extractObjectPropertiesFromShape(shape, types, maxDepth);
}

export function extractWebhookPayloadProperties(
    shape: ApiDefinition.WebhookPayloadShape,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    maxDepth: number = 2
): ExtractedProperty[] {
    if (shape.type === "object") {
        const properties: ExtractedProperty[] = [];
        for (const prop of shape.properties) {
            properties.push({ property: prop, breadcrumb: [] });

            const nestedProperties = extractObjectPropertiesFromShape(prop.valueShape, types, maxDepth, 1, [
                {
                    key: prop.key,
                    display_name: prop.key,
                    optional: isTypeOptional(prop.valueShape)
                }
            ]);
            properties.push(...nestedProperties);
        }
        return properties;
    }

    if (shape.type === "alias") {
        return extractObjectPropertiesFromShape(shape.value, types, maxDepth);
    }

    if (shape.type === "formData") {
        const properties: ExtractedProperty[] = [];
        for (const field of shape.fields) {
            if (field.type === "property") {
                properties.push({
                    property: {
                        key: field.key,
                        valueShape: field.valueShape,
                        description: field.description,
                        availability: field.availability,
                        propertyAccess: field.propertyAccess
                    },
                    breadcrumb: []
                });
            }
        }
        return properties;
    }

    return [];
}
