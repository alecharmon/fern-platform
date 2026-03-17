import type { APIV1Read } from "../../client";
import { ApiDefinitionV1ToLatest } from "../migrators/v1ToV2";

/**
 * Helper to create a minimal valid V1 ApiDefinition for testing.
 */
function createMinimalV1Api(overrides: Partial<APIV1Read.ApiDefinition> = {}): APIV1Read.ApiDefinition {
    return {
        id: "test-api-id",
        rootPackage: {
            endpoints: [],
            websockets: [],
            webhooks: [],
            graphqlOperations: [],
            types: [],
            subpackages: [],
            pointsTo: undefined
        },
        types: {},
        subpackages: {},
        snippetsConfiguration: undefined,
        auth: undefined,
        ...overrides
    };
}

describe("ApiDefinitionV1ToLatest", () => {
    describe("migrate", () => {
        it("should migrate a minimal empty API definition", () => {
            const v1 = createMinimalV1Api();
            const result = ApiDefinitionV1ToLatest.from(v1).migrate();

            expect(result.id).toBe("test-api-id");
            expect(result.endpoints).toEqual({});
            expect(result.websockets).toEqual({});
            expect(result.webhooks).toEqual({});
            expect(result.types).toEqual({});
            expect(result.subpackages).toEqual({});
        });

        it("should migrate types with primitive shapes", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-1": {
                        name: "PlantName",
                        description: "The name of a plant",
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "primitive",
                                value: {
                                    type: "string",
                                    regex: undefined,
                                    minLength: undefined,
                                    maxLength: undefined,
                                    default: undefined,
                                    format: undefined
                                }
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            expect(result.types["type-1"]).toBeDefined();
            expect(result.types["type-1"]!.name).toBe("PlantName");
            expect(result.types["type-1"]!.shape).toEqual({
                type: "alias",
                value: {
                    type: "primitive",
                    value: {
                        type: "string",
                        regex: undefined,
                        minLength: undefined,
                        maxLength: undefined,
                        default: undefined,
                        format: undefined
                    }
                }
            });
        });

        it("should migrate object types with properties", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-plant": {
                        name: "Plant",
                        description: "A plant object",
                        availability: undefined,
                        shape: {
                            type: "object",
                            extends: [],
                            properties: [
                                {
                                    key: "plantId",
                                    description: "The plant identifier",
                                    availability: undefined,
                                    valueType: {
                                        type: "primitive",
                                        value: {
                                            type: "string",
                                            regex: undefined,
                                            minLength: undefined,
                                            maxLength: undefined,
                                            default: undefined,
                                            format: undefined
                                        }
                                    }
                                },
                                {
                                    key: "species",
                                    description: "The plant species",
                                    availability: undefined,
                                    valueType: {
                                        type: "id",
                                        value: "type-species",
                                        default: undefined
                                    }
                                }
                            ],
                            extraProperties: undefined
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const plantType = result.types["type-plant"];
            expect(plantType).toBeDefined();
            expect(plantType!.shape.type).toBe("object");

            if (plantType!.shape.type === "object") {
                expect(plantType!.shape.properties).toHaveLength(2);
                expect(plantType!.shape.properties[0]!.key).toBe("plantId");
                expect(plantType!.shape.properties[0]!.valueShape).toEqual({
                    type: "alias",
                    value: {
                        type: "primitive",
                        value: {
                            type: "string",
                            regex: undefined,
                            minLength: undefined,
                            maxLength: undefined,
                            default: undefined,
                            format: undefined
                        }
                    }
                });
                expect(plantType!.shape.properties[1]!.key).toBe("species");
                expect(plantType!.shape.properties[1]!.valueShape).toEqual({
                    type: "alias",
                    value: {
                        type: "id",
                        id: "type-species",
                        default: undefined
                    }
                });
            }
        });

        it("should migrate enum types", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-season": {
                        name: "Season",
                        description: "Growing season",
                        availability: undefined,
                        shape: {
                            type: "enum",
                            values: [
                                { value: "spring", description: undefined, availability: undefined },
                                { value: "summer", description: undefined, availability: undefined },
                                { value: "fall", description: undefined, availability: undefined },
                                { value: "winter", description: undefined, availability: undefined }
                            ],
                            default: undefined
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const seasonType = result.types["type-season"];
            expect(seasonType).toBeDefined();
            expect(seasonType!.shape.type).toBe("enum");
            if (seasonType!.shape.type === "enum") {
                expect(seasonType!.shape.values).toHaveLength(4);
            }
        });

        it("should migrate discriminated union types", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-plant-type": {
                        name: "PlantType",
                        description: "Type of plant",
                        availability: undefined,
                        shape: {
                            type: "discriminatedUnion",
                            discriminant: "kind",
                            variants: [
                                {
                                    discriminantValue: "flower",
                                    displayName: "Flower",
                                    description: "A flowering plant",
                                    availability: undefined,
                                    additionalProperties: {
                                        extends: [],
                                        properties: [
                                            {
                                                key: "petalCount",
                                                description: undefined,
                                                availability: undefined,
                                                valueType: {
                                                    type: "primitive",
                                                    value: {
                                                        type: "integer",
                                                        minimum: undefined,
                                                        maximum: undefined,
                                                        default: undefined
                                                    }
                                                }
                                            }
                                        ],
                                        extraProperties: undefined
                                    }
                                }
                            ]
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const plantType = result.types["type-plant-type"];
            expect(plantType).toBeDefined();
            expect(plantType!.shape.type).toBe("discriminatedUnion");
            if (plantType!.shape.type === "discriminatedUnion") {
                expect(plantType!.shape.discriminant).toBe("kind");
                expect(plantType!.shape.variants).toHaveLength(1);
                expect(plantType!.shape.variants[0]!.discriminantValue).toBe("flower");
                expect(plantType!.shape.variants[0]!.properties).toHaveLength(1);
            }
        });

        it("should migrate undiscriminated union types", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-plant-id": {
                        name: "PlantId",
                        description: "Either a string or integer ID",
                        availability: undefined,
                        shape: {
                            type: "undiscriminatedUnion",
                            variants: [
                                {
                                    displayName: "StringId",
                                    description: undefined,
                                    availability: undefined,
                                    type: {
                                        type: "primitive",
                                        value: {
                                            type: "string",
                                            regex: undefined,
                                            minLength: undefined,
                                            maxLength: undefined,
                                            default: undefined,
                                            format: undefined
                                        }
                                    }
                                },
                                {
                                    displayName: "IntegerId",
                                    description: undefined,
                                    availability: undefined,
                                    type: {
                                        type: "primitive",
                                        value: {
                                            type: "integer",
                                            minimum: undefined,
                                            maximum: undefined,
                                            default: undefined
                                        }
                                    }
                                }
                            ]
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const plantIdType = result.types["type-plant-id"];
            expect(plantIdType).toBeDefined();
            expect(plantIdType!.shape.type).toBe("undiscriminatedUnion");
            if (plantIdType!.shape.type === "undiscriminatedUnion") {
                expect(plantIdType!.shape.variants).toHaveLength(2);
                expect(plantIdType!.shape.variants[0]!.displayName).toBe("StringId");
            }
        });

        it("should migrate list type references", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-plant-list": {
                        name: "PlantList",
                        description: "A list of plants",
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "list",
                                itemType: {
                                    type: "id",
                                    value: "type-plant",
                                    default: undefined
                                },
                                minItems: 0,
                                maxItems: 100
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const listType = result.types["type-plant-list"];
            expect(listType).toBeDefined();
            expect(listType!.shape.type).toBe("alias");
            if (listType!.shape.type === "alias") {
                expect(listType!.shape.value.type).toBe("list");
                if (listType!.shape.value.type === "list") {
                    expect(listType!.shape.value.itemShape).toEqual({
                        type: "alias",
                        value: {
                            type: "id",
                            id: "type-plant",
                            default: undefined
                        }
                    });
                    expect(listType!.shape.value.minItems).toBe(0);
                    expect(listType!.shape.value.maxItems).toBe(100);
                }
            }
        });

        it("should migrate set type references", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-plant-tags": {
                        name: "PlantTags",
                        description: "Unique tags for a plant",
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "set",
                                itemType: {
                                    type: "primitive",
                                    value: {
                                        type: "string",
                                        regex: undefined,
                                        minLength: undefined,
                                        maxLength: undefined,
                                        default: undefined,
                                        format: undefined
                                    }
                                },
                                minItems: undefined,
                                maxItems: undefined
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const tagsType = result.types["type-plant-tags"];
            expect(tagsType).toBeDefined();
            if (tagsType!.shape.type === "alias" && tagsType!.shape.value.type === "set") {
                expect(tagsType!.shape.value.itemShape.type).toBe("alias");
            }
        });

        it("should migrate map type references", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-plant-metadata": {
                        name: "PlantMetadata",
                        description: "Key-value metadata for a plant",
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "map",
                                keyType: {
                                    type: "primitive",
                                    value: {
                                        type: "string",
                                        regex: undefined,
                                        minLength: undefined,
                                        maxLength: undefined,
                                        default: undefined,
                                        format: undefined
                                    }
                                },
                                valueType: {
                                    type: "primitive",
                                    value: {
                                        type: "string",
                                        regex: undefined,
                                        minLength: undefined,
                                        maxLength: undefined,
                                        default: undefined,
                                        format: undefined
                                    }
                                },
                                minProperties: undefined,
                                maxProperties: undefined
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const metaType = result.types["type-plant-metadata"];
            expect(metaType).toBeDefined();
            if (metaType!.shape.type === "alias" && metaType!.shape.value.type === "map") {
                expect(metaType!.shape.value.keyShape.type).toBe("alias");
                expect(metaType!.shape.value.valueShape.type).toBe("alias");
            }
        });

        it("should migrate optional and nullable type references", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-optional-name": {
                        name: "OptionalPlantName",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "optional",
                                itemType: {
                                    type: "primitive",
                                    value: {
                                        type: "string",
                                        regex: undefined,
                                        minLength: undefined,
                                        maxLength: undefined,
                                        default: undefined,
                                        format: undefined
                                    }
                                },
                                defaultValue: "Fern"
                            }
                        },
                        displayName: undefined
                    },
                    "type-nullable-name": {
                        name: "NullablePlantName",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "nullable",
                                itemType: {
                                    type: "primitive",
                                    value: {
                                        type: "string",
                                        regex: undefined,
                                        minLength: undefined,
                                        maxLength: undefined,
                                        default: undefined,
                                        format: undefined
                                    }
                                }
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();

            const optType = result.types["type-optional-name"];
            expect(optType).toBeDefined();
            if (optType!.shape.type === "alias" && optType!.shape.value.type === "optional") {
                expect(optType!.shape.value.default).toBe("Fern");
                expect(optType!.shape.value.shape.type).toBe("alias");
            }

            const nullType = result.types["type-nullable-name"];
            expect(nullType).toBeDefined();
            if (nullType!.shape.type === "alias" && nullType!.shape.value.type === "nullable") {
                expect(nullType!.shape.value.shape.type).toBe("alias");
            }
        });

        it("should migrate literal type references", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-literal": {
                        name: "PlantKind",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "literal",
                                value: {
                                    type: "stringLiteral",
                                    value: "fern"
                                }
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const litType = result.types["type-literal"];
            expect(litType).toBeDefined();
            if (litType!.shape.type === "alias") {
                expect(litType!.shape.value).toEqual({
                    type: "literal",
                    value: {
                        type: "stringLiteral",
                        value: "fern"
                    }
                });
            }
        });

        it("should migrate unknown type references", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-unknown": {
                        name: "AnyValue",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "alias",
                            value: {
                                type: "unknown"
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const unknownType = result.types["type-unknown"];
            expect(unknownType).toBeDefined();
            if (unknownType!.shape.type === "alias") {
                expect(unknownType!.shape.value).toEqual({
                    type: "unknown",
                    displayName: undefined
                });
            }
        });

        it("should migrate object types with extraProperties", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-plant-extra": {
                        name: "PlantExtra",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "object",
                            extends: [],
                            properties: [],
                            extraProperties: {
                                type: "primitive",
                                value: {
                                    type: "string",
                                    regex: undefined,
                                    minLength: undefined,
                                    maxLength: undefined,
                                    default: undefined,
                                    format: undefined
                                }
                            }
                        },
                        displayName: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const extraType = result.types["type-plant-extra"];
            expect(extraType).toBeDefined();
            if (extraType!.shape.type === "object") {
                expect(extraType!.shape.extraProperties).toBeDefined();
                expect(extraType!.shape.extraProperties!.type).toBe("primitive");
            }
        });
    });

    describe("migrateTypeReference - edge cases for undefined type bug", () => {
        it("should handle object property with undefined valueType gracefully", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-broken": {
                        name: "BrokenPlant",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "object",
                            extends: [],
                            properties: [
                                {
                                    key: "goodProp",
                                    description: undefined,
                                    availability: undefined,
                                    valueType: {
                                        type: "primitive",
                                        value: {
                                            type: "string",
                                            regex: undefined,
                                            minLength: undefined,
                                            maxLength: undefined,
                                            default: undefined,
                                            format: undefined
                                        }
                                    }
                                },
                                {
                                    key: "brokenProp",
                                    description: undefined,
                                    availability: undefined,
                                    // valueType is undefined - this is the bug scenario
                                    valueType: undefined as unknown as APIV1Read.TypeReference
                                }
                            ],
                            extraProperties: undefined
                        },
                        displayName: undefined
                    }
                }
            });

            // Before fix: TypeError: Cannot read properties of undefined (reading 'type')
            // After fix: should not throw, broken properties should be filtered out
            expect(() => ApiDefinitionV1ToLatest.from(v1).migrate()).not.toThrow();

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const brokenType = result.types["type-broken"];
            expect(brokenType).toBeDefined();
            if (brokenType!.shape.type === "object") {
                // The good property should still be present
                expect(brokenType!.shape.properties.some((p) => p.key === "goodProp")).toBe(true);
                // The broken property should be filtered out
                expect(brokenType!.shape.properties.some((p) => p.key === "brokenProp")).toBe(false);
            }
        });

        it("should handle discriminated union variant with undefined valueType in properties", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-union": {
                        name: "PlantUnion",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "discriminatedUnion",
                            discriminant: "type",
                            variants: [
                                {
                                    discriminantValue: "flower",
                                    displayName: undefined,
                                    description: undefined,
                                    availability: undefined,
                                    additionalProperties: {
                                        extends: [],
                                        properties: [
                                            {
                                                key: "color",
                                                description: undefined,
                                                availability: undefined,
                                                valueType: undefined as unknown as APIV1Read.TypeReference
                                            }
                                        ],
                                        extraProperties: undefined
                                    }
                                }
                            ]
                        },
                        displayName: undefined
                    }
                }
            });

            // Should not throw
            expect(() => ApiDefinitionV1ToLatest.from(v1).migrate()).not.toThrow();
        });

        it("should handle undiscriminated union variant with undefined type gracefully", () => {
            const v1 = createMinimalV1Api({
                types: {
                    "type-undiscriminated": {
                        name: "PlantIdOrName",
                        description: undefined,
                        availability: undefined,
                        shape: {
                            type: "undiscriminatedUnion",
                            variants: [
                                {
                                    displayName: "ValidVariant",
                                    description: undefined,
                                    availability: undefined,
                                    type: {
                                        type: "primitive",
                                        value: {
                                            type: "string",
                                            regex: undefined,
                                            minLength: undefined,
                                            maxLength: undefined,
                                            default: undefined,
                                            format: undefined
                                        }
                                    }
                                },
                                {
                                    displayName: "BrokenVariant",
                                    description: undefined,
                                    availability: undefined,
                                    type: undefined as unknown as APIV1Read.TypeReference
                                }
                            ]
                        },
                        displayName: undefined
                    }
                }
            });

            // Should not throw
            expect(() => ApiDefinitionV1ToLatest.from(v1).migrate()).not.toThrow();

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const unionType = result.types["type-undiscriminated"];
            expect(unionType).toBeDefined();
            if (unionType!.shape.type === "undiscriminatedUnion") {
                // The valid variant should still be present
                expect(unionType!.shape.variants.some((v) => v.displayName === "ValidVariant")).toBe(true);
                // The broken variant should be filtered out
                expect(unionType!.shape.variants.some((v) => v.displayName === "BrokenVariant")).toBe(false);
            }
        });

        it("should handle parameter with undefined type gracefully", () => {
            const v1 = createMinimalV1Api({
                rootPackage: {
                    endpoints: [
                        {
                            id: "get-plant",
                            description: undefined,
                            availability: undefined,
                            authed: false,
                            name: "Get Plant",
                            method: "GET",
                            path: {
                                parts: [
                                    { type: "literal", value: "/plants/" },
                                    { type: "pathParameter", value: "plantId" }
                                ],
                                pathParameters: [
                                    {
                                        key: "plantId",
                                        description: undefined,
                                        availability: undefined,
                                        type: undefined as unknown as APIV1Read.TypeReference
                                    }
                                ]
                            },
                            urlSlug: "get-plant",
                            queryParameters: [],
                            headers: [],
                            request: undefined,
                            response: undefined,
                            errorsV2: undefined,
                            examples: [],
                            errors: [],
                            environments: [],
                            protocol: undefined,
                            includeInApiExplorer: true
                        }
                    ],
                    websockets: [],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: [],
                    pointsTo: undefined
                }
            });

            // Should not throw
            expect(() => ApiDefinitionV1ToLatest.from(v1).migrate()).not.toThrow();
        });

        it("should handle header with undefined type gracefully", () => {
            const v1 = createMinimalV1Api({
                globalHeaders: [
                    {
                        key: "X-Plant-Version",
                        description: undefined,
                        availability: undefined,
                        type: undefined as unknown as APIV1Read.TypeReference
                    }
                ]
            });

            // Should not throw
            expect(() => ApiDefinitionV1ToLatest.from(v1).migrate()).not.toThrow();
        });
    });

    describe("subpackages", () => {
        it("should migrate subpackages and namespace correctly", () => {
            const v1 = createMinimalV1Api({
                rootPackage: {
                    endpoints: [],
                    websockets: [],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: ["sub-1"],
                    pointsTo: undefined
                },
                subpackages: {
                    "sub-1": {
                        subpackageId: "sub-1",
                        name: "plants",
                        urlSlug: "plants",
                        displayName: "Plants API",
                        parent: undefined,
                        endpoints: [],
                        websockets: [],
                        webhooks: [],
                        graphqlOperations: [],
                        types: [],
                        subpackages: [],
                        pointsTo: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            expect(result.subpackages["sub-1"]).toBeDefined();
            expect(result.subpackages["sub-1"]!.name).toBe("plants");
            expect(result.subpackages["sub-1"]!.displayName).toBe("Plants API");
        });

        it("should handle nested subpackages", () => {
            const v1 = createMinimalV1Api({
                rootPackage: {
                    endpoints: [],
                    websockets: [],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: ["sub-1"],
                    pointsTo: undefined
                },
                subpackages: {
                    "sub-1": {
                        subpackageId: "sub-1",
                        name: "plants",
                        urlSlug: "plants",
                        displayName: undefined,
                        parent: undefined,
                        endpoints: [],
                        websockets: [],
                        webhooks: [],
                        graphqlOperations: [],
                        types: [],
                        subpackages: ["sub-2"],
                        pointsTo: undefined
                    },
                    "sub-2": {
                        subpackageId: "sub-2",
                        name: "species",
                        urlSlug: "species",
                        displayName: undefined,
                        parent: "sub-1",
                        endpoints: [],
                        websockets: [],
                        webhooks: [],
                        graphqlOperations: [],
                        types: [],
                        subpackages: [],
                        pointsTo: undefined
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            expect(result.subpackages["sub-1"]).toBeDefined();
            expect(result.subpackages["sub-2"]).toBeDefined();
        });
    });

    describe("auth", () => {
        it("should migrate auth schemes from authSchemes field", () => {
            const v1 = createMinimalV1Api({
                authSchemes: {
                    "api-key": {
                        type: "header",
                        nameOverride: undefined,
                        headerWireValue: "X-API-Key",
                        prefix: "Bearer"
                    }
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            expect(result.auths).toEqual({
                "api-key": {
                    type: "header",
                    nameOverride: undefined,
                    headerWireValue: "X-API-Key",
                    prefix: "Bearer"
                }
            });
        });

        it("should migrate auth from legacy auth field", () => {
            const v1 = createMinimalV1Api({
                auth: {
                    type: "bearerAuth",
                    tokenName: "token"
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            expect(result.auths).toEqual({
                default: {
                    type: "bearerAuth",
                    tokenName: "token"
                }
            });
        });

        it("should return empty auths when no auth is configured", () => {
            const v1 = createMinimalV1Api();
            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            expect(result.auths).toEqual({});
        });
    });

    describe("migrateWebSocket - auth scheme ID resolution", () => {
        it("should use authSchemes keys when authSchemes is present and channel auth is true", () => {
            const v1 = createMinimalV1Api({
                authSchemes: {
                    BearerAuth: {
                        type: "header",
                        headerWireValue: "Authorization",
                        nameOverride: "BearerAuth",
                        prefix: "Bearer",
                        description: undefined
                    }
                },
                rootPackage: {
                    endpoints: [],
                    websockets: [
                        {
                            id: "ws-1",
                            auth: true,
                            path: { parts: [], pathParameters: [] },
                            headers: [],
                            queryParameters: [],
                            messages: [],
                            examples: [],
                            name: "TestWebSocket",
                            urlSlug: "test-ws",
                            description: undefined,
                            availability: undefined,
                            defaultEnvironment: undefined,
                            environments: undefined
                        } as unknown as APIV1Read.WebSocketChannel
                    ],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: [],
                    pointsTo: undefined
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const ws = Object.values(result.websockets)[0];
            expect(ws).toBeDefined();
            expect(ws!.auth).toEqual(["BearerAuth"]);
        });

        it("should use multiple authSchemes keys when multiple schemes are defined", () => {
            const v1 = createMinimalV1Api({
                authSchemes: {
                    BearerAuth: {
                        type: "bearerAuth",
                        tokenName: "token",
                        description: undefined
                    },
                    ApiKeyAuth: {
                        type: "header",
                        headerWireValue: "X-Api-Key",
                        nameOverride: "ApiKeyAuth",
                        prefix: undefined,
                        description: undefined
                    }
                },
                rootPackage: {
                    endpoints: [],
                    websockets: [
                        {
                            id: "ws-1",
                            auth: true,
                            path: { parts: [], pathParameters: [] },
                            headers: [],
                            queryParameters: [],
                            messages: [],
                            examples: [],
                            name: "TestWebSocket",
                            urlSlug: "test-ws",
                            description: undefined,
                            availability: undefined,
                            defaultEnvironment: undefined,
                            environments: undefined
                        } as unknown as APIV1Read.WebSocketChannel
                    ],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: [],
                    pointsTo: undefined
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const ws = Object.values(result.websockets)[0];
            expect(ws).toBeDefined();
            expect(ws!.auth).toEqual(["BearerAuth", "ApiKeyAuth"]);
        });

        it("should fall back to ['default'] when authSchemes is undefined and only auth is set", () => {
            const v1 = createMinimalV1Api({
                auth: {
                    type: "bearerAuth",
                    tokenName: "token",
                    description: undefined
                },
                authSchemes: undefined,
                rootPackage: {
                    endpoints: [],
                    websockets: [
                        {
                            id: "ws-1",
                            auth: true,
                            path: { parts: [], pathParameters: [] },
                            headers: [],
                            queryParameters: [],
                            messages: [],
                            examples: [],
                            name: "TestWebSocket",
                            urlSlug: "test-ws",
                            description: undefined,
                            availability: undefined,
                            defaultEnvironment: undefined,
                            environments: undefined
                        } as unknown as APIV1Read.WebSocketChannel
                    ],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: [],
                    pointsTo: undefined
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const ws = Object.values(result.websockets)[0];
            expect(ws).toBeDefined();
            expect(ws!.auth).toEqual(["default"]);
        });

        it("should set auth to undefined when channel auth is false", () => {
            const v1 = createMinimalV1Api({
                authSchemes: {
                    BearerAuth: {
                        type: "bearerAuth",
                        tokenName: "token",
                        description: undefined
                    }
                },
                rootPackage: {
                    endpoints: [],
                    websockets: [
                        {
                            id: "ws-1",
                            auth: false,
                            path: { parts: [], pathParameters: [] },
                            headers: [],
                            queryParameters: [],
                            messages: [],
                            examples: [],
                            name: "TestWebSocket",
                            urlSlug: "test-ws",
                            description: undefined,
                            availability: undefined,
                            defaultEnvironment: undefined,
                            environments: undefined
                        } as unknown as APIV1Read.WebSocketChannel
                    ],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: [],
                    pointsTo: undefined
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const ws = Object.values(result.websockets)[0];
            expect(ws).toBeDefined();
            expect(ws!.auth).toBeUndefined();
        });

        it("should resolve auth scheme IDs that match the auths map keys", () => {
            const v1 = createMinimalV1Api({
                authSchemes: {
                    BearerAuth: {
                        type: "header",
                        headerWireValue: "Authorization",
                        nameOverride: "BearerAuth",
                        prefix: "Bearer",
                        description: undefined
                    }
                },
                rootPackage: {
                    endpoints: [],
                    websockets: [
                        {
                            id: "ws-1",
                            auth: true,
                            path: { parts: [], pathParameters: [] },
                            headers: [],
                            queryParameters: [],
                            messages: [],
                            examples: [],
                            name: "TestWebSocket",
                            urlSlug: "test-ws",
                            description: undefined,
                            availability: undefined,
                            defaultEnvironment: undefined,
                            environments: undefined
                        } as unknown as APIV1Read.WebSocketChannel
                    ],
                    webhooks: [],
                    graphqlOperations: [],
                    types: [],
                    subpackages: [],
                    pointsTo: undefined
                }
            });

            const result = ApiDefinitionV1ToLatest.from(v1).migrate();
            const ws = Object.values(result.websockets)[0];

            // Verify the auth IDs on the WebSocket match the keys in the auths map
            expect(ws!.auth).toBeDefined();
            for (const authId of ws!.auth!) {
                expect(result.auths[authId]).toBeDefined();
            }
            expect(result.auths["BearerAuth"]).toEqual({
                type: "header",
                headerWireValue: "Authorization",
                nameOverride: "BearerAuth",
                prefix: "Bearer",
                description: undefined
            });
        });
    });

    describe("static helpers", () => {
        it("createEndpointId should use originalEndpointId when present", () => {
            const endpoint = {
                id: "get-plant",
                originalEndpointId: "original-id"
            } as APIV1Read.EndpointDefinition;

            expect(ApiDefinitionV1ToLatest.createEndpointId(endpoint, "sub-1")).toBe("original-id");
        });

        it("createEndpointId should construct id from subpackageId and endpoint id", () => {
            const endpoint = {
                id: "get-plant"
            } as APIV1Read.EndpointDefinition;

            expect(ApiDefinitionV1ToLatest.createEndpointId(endpoint, "sub-1")).toBe("sub-1.get-plant");
        });

        it("createEndpointId should use ROOT_PACKAGE_ID as default subpackageId", () => {
            const endpoint = {
                id: "get-plant"
            } as APIV1Read.EndpointDefinition;

            expect(ApiDefinitionV1ToLatest.createEndpointId(endpoint)).toBe("__package__.get-plant");
        });

        it("createWebSocketId should construct id correctly", () => {
            const ws = { id: "plant-feed" } as APIV1Read.WebSocketChannel;
            expect(ApiDefinitionV1ToLatest.createWebSocketId(ws, "sub-1")).toBe("sub-1.plant-feed");
        });

        it("createWebhookId should construct id correctly", () => {
            const webhook = { id: "plant-updated" } as APIV1Read.WebhookDefinition;
            expect(ApiDefinitionV1ToLatest.createWebhookId(webhook, "sub-1")).toBe("sub-1.plant-updated");
        });
    });
});
