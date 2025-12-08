// @ts-nocheck - Test file with complex mock data that doesn't fully match SDK types

import type { ApiDefinition } from "@fern-api/fdr-sdk";
import { describe, expect, it } from "vitest";

import type { EndpointBaseRecord } from "../types";
import {
    createParameterRecord,
    extractBodyProperties,
    extractObjectPropertiesFromShape,
    getTypeDisplayName
} from "./create-parameter-records";

const TypeId = (value: string): ApiDefinition.TypeId => value as unknown as ApiDefinition.TypeId;
const PropertyKey = (value: string): ApiDefinition.PropertyKey => value as unknown as ApiDefinition.PropertyKey;

const STRING_PRIMITIVE: ApiDefinition.TypeReference.Primitive = {
    type: "primitive",
    value: {
        type: "string",
        format: undefined,
        regex: undefined,
        minLength: undefined,
        maxLength: undefined,
        default: undefined
    }
};

const INTEGER_PRIMITIVE: ApiDefinition.TypeReference.Primitive = {
    type: "primitive",
    value: {
        type: "integer",
        minimum: undefined,
        maximum: undefined,
        default: undefined
    }
};

const BOOLEAN_PRIMITIVE: ApiDefinition.TypeReference.Primitive = {
    type: "primitive",
    value: {
        type: "boolean",
        default: undefined
    }
};

const DATETIME_PRIMITIVE: ApiDefinition.TypeReference.Primitive = {
    type: "primitive",
    value: {
        type: "datetime",
        default: undefined
    }
};

const createMockEndpointBase = (): EndpointBaseRecord => ({
    objectID: "org:domain:endpoint-1",
    org_id: "org",
    domain: "domain",
    canonicalPathname: "/api/users",
    pathname: "/api/users",
    title: "Get Users",
    icon: undefined,
    keywords: ["users"],
    api_type: "http",
    api_definition_id: "api-def-1",
    api_endpoint_id: "endpoint-1",
    endpoint_path: "/users",
    endpoint_path_alternates: undefined,
    method: "GET",
    response_type: "json",
    environments: [],
    default_environment_id: undefined,
    breadcrumb: [{ title: "API", pathname: "/api" }],
    visible_by: [],
    authed: false,
    page_position: 1,
    version: undefined
});

const createProperty = (
    key: string,
    valueShape: ApiDefinition.TypeShape,
    description?: string
): ApiDefinition.ObjectProperty => ({
    key: PropertyKey(key),
    valueShape,
    description,
    availability: undefined,
    propertyAccess: undefined
});

const createObjectShape = (properties: ApiDefinition.ObjectProperty[]): ApiDefinition.TypeShape.Object_ => ({
    type: "object",
    properties,
    extends: [],
    extraProperties: undefined
});

const emptyTypes: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {};

describe("createParameterRecord", () => {
    it("creates a basic parameter record", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("limit", {
            type: "alias",
            value: INTEGER_PRIMITIVE
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "query",
            types: emptyTypes
        });

        expect(record.type).toBe("parameter");
        expect(record.parameter_name).toBe("limit");
        expect(record.parameter_type).toBe("integer");
        expect(record.section_type).toBe("request");
        expect(record.subsection_type).toBe("query");
        expect(record.hash).toBe("#request.query.limit");
        expect(record.objectID).toBe("org:domain:endpoint-1-param-request-query-limit");
    });

    it("handles nested breadcrumb correctly", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("city", {
            type: "alias",
            value: STRING_PRIMITIVE
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "body",
            breadcrumb: [{ key: "address", display_name: "address", optional: false }],
            types: emptyTypes
        });

        expect(record.parameter_breadcrumb).toEqual([
            { key: "address", display_name: "address", optional: false },
            { key: "city", display_name: "city", optional: false }
        ]);
        expect(record.hash).toBe("#request.body.address.city");
        expect(record.objectID).toBe("org:domain:endpoint-1-param-request-body-address.city");
    });

    it("includes status_code in hash for error responses", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("message", {
            type: "alias",
            value: STRING_PRIMITIVE
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "response",
            subsection_type: "body",
            status_code: "400",
            types: emptyTypes
        });

        expect(record.hash).toBe("#response.400.message");
        expect(record.objectID).toBe("org:domain:endpoint-1-param-response-400-body-message");
        expect(record.status_code).toBe("400");
    });

    it("includes websocket_origin in objectID", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("data", {
            type: "alias",
            value: STRING_PRIMITIVE
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "body",
            websocket_origin: "client",
            types: emptyTypes
        });

        expect(record.objectID).toBe("org:domain:endpoint-1-param-request-client-body-data");
        expect(record.websocket_origin).toBe("client");
    });

    it("marks optional types correctly in breadcrumb", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("nickname", {
            type: "optional",
            shape: { type: "alias", value: STRING_PRIMITIVE },
            default: undefined
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "body",
            types: emptyTypes
        });

        expect(record.parameter_breadcrumb[0]?.optional).toBe(true);
    });

    it("marks nullable types as optional in breadcrumb", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("deletedAt", {
            type: "nullable",
            shape: { type: "alias", value: DATETIME_PRIMITIVE },
            default: undefined
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "response",
            subsection_type: "body",
            types: emptyTypes
        });

        expect(record.parameter_breadcrumb[0]?.optional).toBe(true);
    });
});

describe("getTypeDisplayName", () => {
    it("handles all primitive types", () => {
        const primitives: [string, ApiDefinition.PrimitiveType][] = [
            [
                "string",
                {
                    type: "string",
                    format: undefined,
                    regex: undefined,
                    minLength: undefined,
                    maxLength: undefined,
                    default: undefined
                }
            ],
            [
                "integer",
                {
                    type: "integer",
                    minimum: undefined,
                    maximum: undefined,
                    default: undefined
                }
            ],
            [
                "long",
                {
                    type: "long",
                    minimum: undefined,
                    maximum: undefined,
                    default: undefined
                }
            ],
            [
                "double",
                {
                    type: "double",
                    minimum: undefined,
                    maximum: undefined,
                    default: undefined
                }
            ],
            ["boolean", { type: "boolean", default: undefined }],
            ["datetime", { type: "datetime", default: undefined }],
            ["uuid", { type: "uuid", default: undefined }],
            ["base64", { type: "base64", default: undefined, mimeType: undefined }],
            ["date", { type: "date", default: undefined }],
            ["bigInteger", { type: "bigInteger", default: undefined }],
            ["uint", { type: "uint" }],
            ["uint64", { type: "uint64" }]
        ];

        for (const [expected, value] of primitives) {
            const shape: ApiDefinition.TypeReference.Primitive = {
                type: "primitive",
                value
            };
            expect(getTypeDisplayName(shape, emptyTypes)).toBe(expected);
        }
    });

    it("handles list types", () => {
        const shape: ApiDefinition.TypeReference.List = {
            type: "list",
            itemShape: STRING_PRIMITIVE
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("list<string>");
    });

    it("handles set types", () => {
        const shape: ApiDefinition.TypeReference.Set = {
            type: "set",
            itemShape: INTEGER_PRIMITIVE
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("set<integer>");
    });

    it("handles map types", () => {
        const shape: ApiDefinition.TypeReference.Map = {
            type: "map",
            keyShape: STRING_PRIMITIVE,
            valueShape: INTEGER_PRIMITIVE
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("map<string, integer>");
    });

    it("unwraps optional types", () => {
        const shape: ApiDefinition.TypeReference.Optional = {
            type: "optional",
            shape: STRING_PRIMITIVE,
            default: undefined
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("string");
    });

    it("unwraps nullable types", () => {
        const shape: ApiDefinition.TypeReference.Nullable = {
            type: "nullable",
            shape: BOOLEAN_PRIMITIVE,
            default: undefined
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("boolean");
    });

    it("resolves type references by id", () => {
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("type-user")]: {
                name: "User",
                displayName: "User",
                shape: createObjectShape([]),
                description: undefined,
                availability: undefined
            }
        };
        const shape: ApiDefinition.TypeReference.Id = {
            type: "id",
            id: TypeId("type-user"),
            default: undefined
        };
        expect(getTypeDisplayName(shape, types)).toBe("User");
    });

    it("falls back to id when type definition has no name", () => {
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("type-unknown")]: {
                name: "type-unknown",
                displayName: undefined,
                shape: createObjectShape([]),
                description: undefined,
                availability: undefined
            }
        };
        const shape: ApiDefinition.TypeReference.Id = {
            type: "id",
            id: TypeId("type-unknown"),
            default: undefined
        };
        expect(getTypeDisplayName(shape, types)).toBe("type-unknown");
    });

    it("handles literal string values", () => {
        const shape: ApiDefinition.TypeReference.Literal = {
            type: "literal",
            value: { type: "stringLiteral", value: "active" }
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe('"active"');
    });

    it("handles literal boolean values", () => {
        const shape: ApiDefinition.TypeReference.Literal = {
            type: "literal",
            value: { type: "booleanLiteral", value: true }
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("true");
    });

    it("handles unknown type", () => {
        const shape: ApiDefinition.TypeReference.Unknown = {
            type: "unknown",
            displayName: undefined
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("unknown");
    });

    it("handles enum type", () => {
        const shape: ApiDefinition.TypeShape.Enum = {
            type: "enum",
            values: [
                { value: "A", description: undefined, availability: undefined },
                { value: "B", description: undefined, availability: undefined }
            ],
            default: undefined
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("enum");
    });

    it("handles discriminatedUnion type", () => {
        const shape: ApiDefinition.TypeShape.DiscriminatedUnion = {
            type: "discriminatedUnion",
            discriminant: PropertyKey("type"),
            variants: []
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("union");
    });

    it("handles undiscriminatedUnion type", () => {
        const shape: ApiDefinition.TypeShape.UndiscriminatedUnion = {
            type: "undiscriminatedUnion",
            variants: []
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("union");
    });

    it("handles alias types", () => {
        const shape: ApiDefinition.TypeShape.Alias = {
            type: "alias",
            value: STRING_PRIMITIVE
        };
        expect(getTypeDisplayName(shape, emptyTypes)).toBe("string");
    });

    it("returns undefined for shapes without type field", () => {
        const shape = {} as ApiDefinition.TypeShapeOrReference;
        expect(getTypeDisplayName(shape, emptyTypes)).toBeUndefined();
    });
});

describe("extractObjectPropertiesFromShape", () => {
    it("extracts properties from object shape", () => {
        const shape: ApiDefinition.TypeShape.Object_ = createObjectShape([
            createProperty("name", { type: "alias", value: STRING_PRIMITIVE }),
            createProperty("age", { type: "alias", value: INTEGER_PRIMITIVE })
        ]);

        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 2);

        expect(result).toHaveLength(2);
        expect(result[0]?.property.key).toBe("name");
        expect(result[0]?.breadcrumb).toEqual([]);
        expect(result[1]?.property.key).toBe("age");
    });

    it("extracts nested properties with breadcrumb", () => {
        const shape: ApiDefinition.TypeShape.Object_ = createObjectShape([
            createProperty(
                "address",
                createObjectShape([
                    createProperty("city", { type: "alias", value: STRING_PRIMITIVE }),
                    createProperty("zip", { type: "alias", value: STRING_PRIMITIVE })
                ])
            )
        ]);

        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 2);

        expect(result).toHaveLength(3);
        expect(result[0]?.property.key).toBe("address");
        expect(result[0]?.breadcrumb).toEqual([]);
        expect(result[1]?.property.key).toBe("city");
        expect(result[1]?.breadcrumb).toEqual([{ key: "address", display_name: "address", optional: false }]);
        expect(result[2]?.property.key).toBe("zip");
        expect(result[2]?.breadcrumb).toEqual([{ key: "address", display_name: "address", optional: false }]);
    });

    it("respects maxDepth limit", () => {
        const level3 = createObjectShape([createProperty("level3", { type: "alias", value: STRING_PRIMITIVE })]);
        const level2 = createObjectShape([createProperty("level2", level3)]);
        const level1 = createObjectShape([createProperty("level1", level2)]);

        const result = extractObjectPropertiesFromShape(level1, emptyTypes, 2);

        expect(result).toHaveLength(2);
        expect(result[0]?.property.key).toBe("level1");
        expect(result[1]?.property.key).toBe("level2");
    });

    it("handles circular type references without infinite loop", () => {
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("type-node")]: {
                name: "Node",
                displayName: "Node",
                shape: createObjectShape([
                    createProperty("value", { type: "alias", value: STRING_PRIMITIVE }),
                    createProperty("child", {
                        type: "alias",
                        value: { type: "id", id: TypeId("type-node"), default: undefined }
                    })
                ]),
                description: undefined,
                availability: undefined
            }
        };
        const shape: ApiDefinition.TypeReference.Id = {
            type: "id",
            id: TypeId("type-node"),
            default: undefined
        };

        const result = extractObjectPropertiesFromShape(shape, types, 3);

        expect(result.length).toBeGreaterThan(0);
        expect(result.some((r) => r.property.key === "value")).toBe(true);
        expect(result.some((r) => r.property.key === "child")).toBe(true);
    });

    it("handles mutually recursive types", () => {
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("type-a")]: {
                name: "TypeA",
                displayName: "TypeA",
                shape: createObjectShape([
                    createProperty("b", {
                        type: "alias",
                        value: { type: "id", id: TypeId("type-b"), default: undefined }
                    })
                ]),
                description: undefined,
                availability: undefined
            },
            [TypeId("type-b")]: {
                name: "TypeB",
                displayName: "TypeB",
                shape: createObjectShape([
                    createProperty("a", {
                        type: "alias",
                        value: { type: "id", id: TypeId("type-a"), default: undefined }
                    })
                ]),
                description: undefined,
                availability: undefined
            }
        };
        const shape: ApiDefinition.TypeReference.Id = {
            type: "id",
            id: TypeId("type-a"),
            default: undefined
        };

        const result = extractObjectPropertiesFromShape(shape, types, 5);

        expect(result.length).toBeGreaterThan(0);
    });

    it("unwraps optional types to extract nested properties", () => {
        const shape: ApiDefinition.TypeReference.Optional = {
            type: "optional",
            shape: {
                type: "alias",
                value: {
                    type: "id",
                    id: TypeId("inner-obj"),
                    default: undefined
                }
            },
            default: undefined
        };
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("inner-obj")]: {
                name: "InnerObj",
                displayName: "InnerObj",
                shape: createObjectShape([createProperty("field", { type: "alias", value: STRING_PRIMITIVE })]),
                description: undefined,
                availability: undefined
            }
        };

        const result = extractObjectPropertiesFromShape(shape, types, 2);

        expect(result).toHaveLength(1);
        expect(result[0]?.property.key).toBe("field");
    });

    it("extracts properties from discriminatedUnion variants", () => {
        const shape: ApiDefinition.TypeShape.DiscriminatedUnion = {
            type: "discriminatedUnion",
            discriminant: PropertyKey("type"),
            variants: [
                {
                    discriminantValue: "dog",
                    properties: [createProperty("bark", { type: "alias", value: BOOLEAN_PRIMITIVE })],
                    extends: [],
                    extraProperties: undefined,
                    availability: undefined,
                    description: undefined,
                    displayName: undefined
                },
                {
                    discriminantValue: "cat",
                    properties: [createProperty("meow", { type: "alias", value: BOOLEAN_PRIMITIVE })],
                    extends: [],
                    extraProperties: undefined,
                    availability: undefined,
                    description: undefined,
                    displayName: undefined
                }
            ]
        };

        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 2);

        expect(result).toHaveLength(2);
        expect(result.some((r) => r.property.key === "bark")).toBe(true);
        expect(result.some((r) => r.property.key === "meow")).toBe(true);
    });

    it("extracts nested properties from discriminatedUnion variants", () => {
        const shape: ApiDefinition.TypeShape.DiscriminatedUnion = {
            type: "discriminatedUnion",
            discriminant: PropertyKey("type"),
            variants: [
                {
                    discriminantValue: "fusion",
                    properties: [
                        createProperty(
                            "config",
                            createObjectShape([
                                createProperty("strategy", {
                                    type: "alias",
                                    value: STRING_PRIMITIVE
                                })
                            ])
                        )
                    ],
                    extends: [],
                    extraProperties: undefined,
                    availability: undefined,
                    description: undefined,
                    displayName: undefined
                }
            ]
        };

        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 3);

        expect(result).toHaveLength(2);
        expect(result[0]?.property.key).toBe("config");
        expect(result[0]?.breadcrumb).toEqual([]);
        expect(result[1]?.property.key).toBe("strategy");
        expect(result[1]?.breadcrumb).toEqual([{ key: "config", display_name: "config", optional: false }]);
    });

    it("extracts properties from undiscriminatedUnion variants", () => {
        const shape: ApiDefinition.TypeShape.UndiscriminatedUnion = {
            type: "undiscriminatedUnion",
            variants: [
                {
                    displayName: "FusionQuery",
                    shape: createObjectShape([
                        createProperty("fusion", {
                            type: "alias",
                            value: STRING_PRIMITIVE
                        })
                    ]),
                    availability: undefined,
                    description: undefined
                },
                {
                    displayName: "VectorQuery",
                    shape: createObjectShape([
                        createProperty("vector", {
                            type: "alias",
                            value: STRING_PRIMITIVE
                        })
                    ]),
                    availability: undefined,
                    description: undefined
                }
            ]
        };

        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 2);

        expect(result).toHaveLength(2);
        expect(result.some((r) => r.property.key === "fusion")).toBe(true);
        expect(result.some((r) => r.property.key === "vector")).toBe(true);
    });

    it("extracts nested properties from undiscriminatedUnion variants", () => {
        const shape: ApiDefinition.TypeShape.UndiscriminatedUnion = {
            type: "undiscriminatedUnion",
            variants: [
                {
                    displayName: "QueryOptions",
                    shape: createObjectShape([
                        createProperty(
                            "options",
                            createObjectShape([
                                createProperty("limit", {
                                    type: "alias",
                                    value: INTEGER_PRIMITIVE
                                })
                            ])
                        )
                    ]),
                    availability: undefined,
                    description: undefined
                }
            ]
        };

        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 3);

        expect(result).toHaveLength(2);
        expect(result[0]?.property.key).toBe("options");
        expect(result[1]?.property.key).toBe("limit");
        expect(result[1]?.breadcrumb).toEqual([
            { key: "QueryOptions", display_name: "QueryOptions" },
            { key: "options", display_name: "options", optional: false }
        ]);
    });

    it("extracts fusion property from Qdrant-like Query union type", () => {
        const fusionEnumShape: ApiDefinition.TypeShape.Enum = {
            type: "enum",
            values: [
                { value: "rrf", description: undefined, availability: undefined },
                { value: "dbsf", description: undefined, availability: undefined }
            ],
            default: undefined
        };

        const queryUnionShape: ApiDefinition.TypeShape.UndiscriminatedUnion = {
            type: "undiscriminatedUnion",
            variants: [
                {
                    displayName: "NearestQuery",
                    shape: createObjectShape([createProperty("nearest", { type: "alias", value: STRING_PRIMITIVE })]),
                    availability: undefined,
                    description: undefined
                },
                {
                    displayName: "FusionQuery",
                    shape: createObjectShape([createProperty("fusion", { type: "alias", value: fusionEnumShape })]),
                    availability: undefined,
                    description: "Fuse the results of multiple prefetches"
                },
                {
                    displayName: "SampleQuery",
                    shape: createObjectShape([createProperty("sample", { type: "alias", value: STRING_PRIMITIVE })]),
                    availability: undefined,
                    description: undefined
                }
            ]
        };

        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("Query")]: {
                name: "Query",
                displayName: "Query",
                shape: queryUnionShape,
                description: undefined,
                availability: undefined
            }
        };

        const requestBodyShape = createObjectShape([
            createProperty("query", {
                type: "alias",
                value: { type: "id", id: TypeId("Query"), default: undefined }
            }),
            createProperty("limit", { type: "alias", value: INTEGER_PRIMITIVE })
        ]);

        const result = extractObjectPropertiesFromShape(requestBodyShape, types, 3);

        expect(result.some((r) => r.property.key === "query")).toBe(true);
        expect(result.some((r) => r.property.key === "limit")).toBe(true);
        expect(result.some((r) => r.property.key === "fusion")).toBe(true);
        expect(result.some((r) => r.property.key === "nearest")).toBe(true);
        expect(result.some((r) => r.property.key === "sample")).toBe(true);

        const fusionProp = result.find((r) => r.property.key === "fusion");
        expect(fusionProp?.breadcrumb).toEqual([
            { key: "query", display_name: "query", optional: false },
            { key: "FusionQuery", display_name: "FusionQuery" }
        ]);
    });

    it("returns empty array for primitive types", () => {
        const result = extractObjectPropertiesFromShape(STRING_PRIMITIVE, emptyTypes, 2);
        expect(result).toHaveLength(0);
    });

    it("returns empty array for list types", () => {
        const shape: ApiDefinition.TypeReference.List = {
            type: "list",
            itemShape: STRING_PRIMITIVE
        };
        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 2);
        expect(result).toHaveLength(0);
    });

    it("returns empty array when type id not found", () => {
        const shape: ApiDefinition.TypeReference.Id = {
            type: "id",
            id: TypeId("nonexistent-type"),
            default: undefined
        };
        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 2);
        expect(result).toHaveLength(0);
    });
});

describe("extractBodyProperties", () => {
    it("extracts properties from object body", () => {
        const body: ApiDefinition.HttpRequestBodyShape.Object_ = {
            type: "object",
            properties: [createProperty("name", { type: "alias", value: STRING_PRIMITIVE })],
            extends: [],
            extraProperties: undefined,
            contentType: "application/json"
        };

        const result = extractBodyProperties(body, emptyTypes, 2);

        expect(result).toHaveLength(1);
        expect(result[0]?.property.key).toBe("name");
    });

    it("extracts nested properties from object body", () => {
        const body: ApiDefinition.HttpRequestBodyShape.Object_ = {
            type: "object",
            properties: [
                createProperty(
                    "user",
                    createObjectShape([createProperty("email", { type: "alias", value: STRING_PRIMITIVE })])
                )
            ],
            extends: [],
            extraProperties: undefined,
            contentType: "application/json"
        };

        const result = extractBodyProperties(body, emptyTypes, 2);

        expect(result).toHaveLength(2);
        expect(result[0]?.property.key).toBe("user");
        expect(result[1]?.property.key).toBe("email");
        expect(result[1]?.breadcrumb).toEqual([{ key: "user", display_name: "user", optional: false }]);
    });

    it("extracts properties from alias body", () => {
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("type-request")]: {
                name: "Request",
                displayName: "Request",
                shape: createObjectShape([createProperty("data", { type: "alias", value: STRING_PRIMITIVE })]),
                description: undefined,
                availability: undefined
            }
        };
        const body: ApiDefinition.HttpRequestBodyShape.Alias = {
            type: "alias",
            value: { type: "id", id: TypeId("type-request"), default: undefined },
            contentType: "application/json"
        };

        const result = extractBodyProperties(body, types, 2);

        expect(result).toHaveLength(1);
        expect(result[0]?.property.key).toBe("data");
    });

    it("extracts properties from formData body", () => {
        const body: ApiDefinition.HttpRequestBodyShape.FormData = {
            type: "formData",
            fields: [
                {
                    type: "property",
                    key: PropertyKey("file"),
                    valueShape: { type: "alias", value: STRING_PRIMITIVE },
                    description: undefined,
                    availability: undefined,
                    propertyAccess: undefined
                },
                {
                    type: "property",
                    key: PropertyKey("name"),
                    valueShape: { type: "alias", value: STRING_PRIMITIVE },
                    description: undefined,
                    availability: undefined,
                    propertyAccess: undefined
                }
            ],
            contentType: "multipart/form-data"
        };

        const result = extractBodyProperties(body, emptyTypes, 2);

        expect(result).toHaveLength(2);
        expect(result[0]?.property.key).toBe("file");
        expect(result[1]?.property.key).toBe("name");
    });

    it("skips non-property formData fields", () => {
        const body: ApiDefinition.HttpRequestBodyShape.FormData = {
            type: "formData",
            fields: [
                {
                    type: "property",
                    key: PropertyKey("name"),
                    valueShape: { type: "alias", value: STRING_PRIMITIVE },
                    description: undefined,
                    availability: undefined,
                    propertyAccess: undefined
                },
                {
                    type: "file",
                    key: PropertyKey("document"),
                    isOptional: false,
                    description: undefined,
                    availability: undefined
                }
            ],
            contentType: "multipart/form-data"
        };

        const result = extractBodyProperties(body, emptyTypes, 2);

        expect(result).toHaveLength(1);
        expect(result[0]?.property.key).toBe("name");
    });

    it("returns empty array for bytes body", () => {
        const body: ApiDefinition.HttpRequestBodyShape.Bytes = {
            type: "bytes",
            isOptional: false,
            contentType: "application/octet-stream"
        };

        const result = extractBodyProperties(body, emptyTypes, 2);

        expect(result).toHaveLength(0);
    });
});

describe("edge cases", () => {
    it("handles empty object properties", () => {
        const shape = createObjectShape([]);
        const result = extractObjectPropertiesFromShape(shape, emptyTypes, 2);
        expect(result).toHaveLength(0);
    });

    it("handles deeply nested optional types", () => {
        const innerObj = createObjectShape([createProperty("deep", { type: "alias", value: STRING_PRIMITIVE })]);
        const shape: ApiDefinition.TypeReference.Optional = {
            type: "optional",
            shape: {
                type: "nullable",
                shape: {
                    type: "optional",
                    shape: {
                        type: "alias",
                        value: { type: "id", id: TypeId("inner"), default: undefined }
                    },
                    default: undefined
                },
                default: undefined
            },
            default: undefined
        };
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("inner")]: {
                name: "Inner",
                displayName: "Inner",
                shape: innerObj,
                description: undefined,
                availability: undefined
            }
        };

        const result = extractObjectPropertiesFromShape(shape, types, 2);

        expect(result).toHaveLength(1);
        expect(result[0]?.property.key).toBe("deep");
    });

    it("handles type alias chains", () => {
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("alias-1")]: {
                name: "Alias1",
                displayName: "Alias1",
                shape: {
                    type: "alias",
                    value: { type: "id", id: TypeId("alias-2"), default: undefined }
                },
                description: undefined,
                availability: undefined
            },
            [TypeId("alias-2")]: {
                name: "Alias2",
                displayName: "Alias2",
                shape: createObjectShape([
                    createProperty("resolved", {
                        type: "alias",
                        value: STRING_PRIMITIVE
                    })
                ]),
                description: undefined,
                availability: undefined
            }
        };
        const shape: ApiDefinition.TypeReference.Id = {
            type: "id",
            id: TypeId("alias-1"),
            default: undefined
        };

        const result = extractObjectPropertiesFromShape(shape, types, 2);

        expect(result).toHaveLength(1);
        expect(result[0]?.property.key).toBe("resolved");
    });

    it("handles special characters in property keys", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("$special.key-name", {
            type: "alias",
            value: STRING_PRIMITIVE
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "body",
            types: emptyTypes
        });

        expect(record.parameter_name).toBe("$special.key-name");
        expect(record.hash).toBe("#request.body.$special.key-name");
    });

    it("handles empty breadcrumb array", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty("field", {
            type: "alias",
            value: STRING_PRIMITIVE
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "query",
            breadcrumb: [],
            types: emptyTypes
        });

        expect(record.parameter_breadcrumb).toHaveLength(1);
        expect(record.parameter_breadcrumb[0]?.key).toBe("field");
    });

    it("preserves description in parameter record", () => {
        const endpointBase = createMockEndpointBase();
        const property = createProperty(
            "limit",
            { type: "alias", value: INTEGER_PRIMITIVE },
            "Maximum number of results to return"
        );

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "query",
            types: emptyTypes
        });

        expect(record.description).toBe("Maximum number of results to return");
    });

    it("handles missing type definition gracefully", () => {
        const shape: ApiDefinition.TypeReference.Id = {
            type: "id",
            id: TypeId("missing-type"),
            default: undefined
        };

        const displayName = getTypeDisplayName(shape, emptyTypes);

        expect(displayName).toBe("missing-type");
    });

    it("handles nested list of objects", () => {
        const shape = createObjectShape([
            createProperty("items", {
                type: "alias",
                value: {
                    type: "list",
                    itemShape: {
                        type: "alias",
                        value: {
                            type: "id",
                            id: TypeId("item-type"),
                            default: undefined
                        }
                    }
                }
            })
        ]);
        const types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition> = {
            [TypeId("item-type")]: {
                name: "Item",
                displayName: "Item",
                shape: createObjectShape([createProperty("id", { type: "alias", value: STRING_PRIMITIVE })]),
                description: undefined,
                availability: undefined
            }
        };

        const result = extractObjectPropertiesFromShape(shape, types, 2);

        expect(result).toHaveLength(1);
        expect(result[0]?.property.key).toBe("items");
    });

    it("combines endpoint keywords with parameter keywords", () => {
        const endpointBase = createMockEndpointBase();
        endpointBase.keywords = ["users", "api"];

        const property = createProperty("limit", {
            type: "alias",
            value: INTEGER_PRIMITIVE
        });

        const record = createParameterRecord({
            endpointBase,
            property,
            section_type: "request",
            subsection_type: "query",
            types: emptyTypes
        });

        expect(record.keywords).toContain("users");
        expect(record.keywords).toContain("api");
        expect(record.keywords).toContain("parameter");
        expect(record.keywords).toContain("integer");
    });
});
