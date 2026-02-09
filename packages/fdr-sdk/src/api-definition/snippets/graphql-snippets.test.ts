import type { TypeId } from "../../navigation";
import type { GraphQlOperation, TypeDefinition } from "../latest";
import { generateGraphQlSnippet } from "./graphql-snippets";

// Helper to create a TypeId
function typeId(id: string): TypeId {
    return id as TypeId;
}

// Helper for primitive alias shapes
function primitiveAlias(primitiveType: string): any {
    return {
        type: "alias",
        value: {
            type: "primitive",
            value: { type: primitiveType }
        }
    };
}

// Helper for type ID reference alias
function idAlias(id: string): any {
    return {
        type: "alias",
        value: { type: "id", id: typeId(id) }
    };
}

describe("generateGraphQlSnippet", () => {
    it("generates variables with primitive arguments", () => {
        const operation: GraphQlOperation = {
            id: "op1",
            operationType: "QUERY",
            name: "getUser",
            arguments: [
                { name: "id", type: primitiveAlias("string"), defaultValue: undefined },
                { name: "includeEmail", type: primitiveAlias("boolean"), defaultValue: undefined }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types: {} });

        expect(result.variables).toEqual({
            id: "example",
            includeEmail: true
        });
    });

    it("generates variables for object arguments with populated properties", () => {
        const types: Record<TypeId, TypeDefinition> = {
            [typeId("UserInput")]: {
                name: "UserInput",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [
                        { key: "name", valueShape: primitiveAlias("string") },
                        { key: "age", valueShape: primitiveAlias("integer") },
                        { key: "active", valueShape: primitiveAlias("boolean") }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any
        };

        const operation: GraphQlOperation = {
            id: "op2",
            operationType: "MUTATION",
            name: "createUser",
            arguments: [{ name: "input", type: idAlias("UserInput"), defaultValue: undefined }],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types });

        expect(result.variables).toEqual({
            input: {
                name: "example",
                age: 0,
                active: true
            }
        });
    });

    it("generates variables for nested object arguments", () => {
        const types: Record<TypeId, TypeDefinition> = {
            [typeId("Address")]: {
                name: "Address",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [
                        { key: "street", valueShape: primitiveAlias("string") },
                        { key: "city", valueShape: primitiveAlias("string") },
                        { key: "zip", valueShape: primitiveAlias("string") }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any,
            [typeId("UserInput")]: {
                name: "UserInput",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [
                        { key: "name", valueShape: primitiveAlias("string") },
                        { key: "address", valueShape: idAlias("Address") }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any
        };

        const operation: GraphQlOperation = {
            id: "op3",
            operationType: "MUTATION",
            name: "createUser",
            arguments: [{ name: "input", type: idAlias("UserInput"), defaultValue: undefined }],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types });

        expect(result.variables).toEqual({
            input: {
                name: "example",
                address: {
                    street: "example",
                    city: "example",
                    zip: "example"
                }
            }
        });
    });

    it("generates variables for inline object type arguments", () => {
        const operation: GraphQlOperation = {
            id: "op-inline",
            operationType: "MUTATION",
            name: "updateSettings",
            arguments: [
                {
                    name: "settings",
                    type: {
                        type: "object",
                        extends: [],
                        properties: [
                            { key: "theme", valueShape: primitiveAlias("string") },
                            { key: "fontSize", valueShape: primitiveAlias("integer") }
                        ],
                        extraProperties: undefined
                    },
                    defaultValue: undefined
                }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types: {} });

        expect(result.variables).toEqual({
            settings: {
                theme: "example",
                fontSize: 0
            }
        });
    });

    it("generates variables for objects with extends (inheritance)", () => {
        const types: Record<TypeId, TypeDefinition> = {
            [typeId("BaseInput")]: {
                name: "BaseInput",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [
                        { key: "id", valueShape: primitiveAlias("string") },
                        { key: "createdAt", valueShape: primitiveAlias("datetime") }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any,
            [typeId("UserInput")]: {
                name: "UserInput",
                shape: {
                    type: "object",
                    extends: [typeId("BaseInput")],
                    properties: [
                        { key: "name", valueShape: primitiveAlias("string") },
                        { key: "email", valueShape: primitiveAlias("string") }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any
        };

        const operation: GraphQlOperation = {
            id: "op4",
            operationType: "MUTATION",
            name: "createUser",
            arguments: [{ name: "input", type: idAlias("UserInput"), defaultValue: undefined }],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types });

        // Inherited properties should appear before own properties
        expect(result.variables.input).toEqual(
            expect.objectContaining({
                id: "example",
                name: "example",
                email: "example"
            })
        );
        expect(Object.keys(result.variables.input as Record<string, unknown>)).toEqual([
            "id",
            "createdAt",
            "name",
            "email"
        ]);
    });

    it("handles circular type references without infinite recursion", () => {
        const types: Record<TypeId, TypeDefinition> = {
            [typeId("Node")]: {
                name: "Node",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [
                        { key: "value", valueShape: primitiveAlias("string") },
                        {
                            key: "children",
                            valueShape: { type: "alias", value: { type: "list", itemShape: idAlias("Node") } }
                        }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any
        };

        const operation: GraphQlOperation = {
            id: "op5",
            operationType: "QUERY",
            name: "getTree",
            arguments: [{ name: "root", type: idAlias("Node"), defaultValue: undefined }],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        // Should not throw or loop infinitely
        const result = generateGraphQlSnippet({ operation, types });

        expect(result.variables.root).toBeDefined();
        const root = result.variables.root as Record<string, unknown>;
        expect(root.value).toBe("example");
        // children should be an array; inner items eventually hit cycle detection
        expect(Array.isArray(root.children)).toBe(true);
    });

    it("generates variables for enum arguments", () => {
        const operation: GraphQlOperation = {
            id: "op6",
            operationType: "QUERY",
            name: "getItems",
            arguments: [
                {
                    name: "sortOrder",
                    type: {
                        type: "enum",
                        values: [{ value: "ASC" }, { value: "DESC" }]
                    },
                    defaultValue: undefined
                }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types: {} });

        expect(result.variables).toEqual({
            sortOrder: "ASC"
        });
    });

    it("generates variables for discriminated union arguments", () => {
        const operation: GraphQlOperation = {
            id: "op7",
            operationType: "MUTATION",
            name: "processPayment",
            arguments: [
                {
                    name: "method",
                    type: {
                        type: "discriminatedUnion",
                        discriminant: "type",
                        variants: [
                            {
                                discriminantValue: "credit_card",
                                displayName: "Credit Card",
                                extends: [],
                                properties: [
                                    { key: "cardNumber", valueShape: primitiveAlias("string") },
                                    { key: "expiry", valueShape: primitiveAlias("string") }
                                ],
                                extraProperties: undefined
                            },
                            {
                                discriminantValue: "bank_transfer",
                                displayName: "Bank Transfer",
                                extends: [],
                                properties: [{ key: "accountNumber", valueShape: primitiveAlias("string") }],
                                extraProperties: undefined
                            }
                        ]
                    },
                    defaultValue: undefined
                }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types: {} });

        expect(result.variables).toEqual({
            method: {
                type: "credit_card",
                cardNumber: "example",
                expiry: "example"
            }
        });
    });

    it("generates variables for undiscriminated union arguments", () => {
        const operation: GraphQlOperation = {
            id: "op8",
            operationType: "MUTATION",
            name: "setValue",
            arguments: [
                {
                    name: "value",
                    type: {
                        type: "undiscriminatedUnion",
                        variants: [
                            {
                                displayName: "String Value",
                                shape: primitiveAlias("string")
                            },
                            {
                                displayName: "Number Value",
                                shape: primitiveAlias("integer")
                            }
                        ]
                    },
                    defaultValue: undefined
                }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types: {} });

        // Uses first variant
        expect(result.variables).toEqual({
            value: "example"
        });
    });

    it("generates variables for list of objects", () => {
        const types: Record<TypeId, TypeDefinition> = {
            [typeId("TagInput")]: {
                name: "TagInput",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [
                        { key: "key", valueShape: primitiveAlias("string") },
                        { key: "value", valueShape: primitiveAlias("string") }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any
        };

        const operation: GraphQlOperation = {
            id: "op9",
            operationType: "MUTATION",
            name: "setTags",
            arguments: [
                {
                    name: "tags",
                    type: {
                        type: "alias",
                        value: {
                            type: "list",
                            itemShape: idAlias("TagInput")
                        }
                    },
                    defaultValue: undefined
                }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types });

        expect(result.variables).toEqual({
            tags: [
                {
                    key: "example",
                    value: "example"
                }
            ]
        });
    });

    it("respects default values over generated ones", () => {
        const operation: GraphQlOperation = {
            id: "op10",
            operationType: "QUERY",
            name: "getUsers",
            arguments: [
                { name: "limit", type: primitiveAlias("integer"), defaultValue: 10 },
                { name: "offset", type: primitiveAlias("integer"), defaultValue: undefined }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types: {} });

        expect(result.variables).toEqual({
            limit: 10,
            offset: 0
        });
    });

    it("generates variables for optional object arguments", () => {
        const types: Record<TypeId, TypeDefinition> = {
            [typeId("FilterInput")]: {
                name: "FilterInput",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [
                        { key: "field", valueShape: primitiveAlias("string") },
                        { key: "value", valueShape: primitiveAlias("string") }
                    ],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any
        };

        const operation: GraphQlOperation = {
            id: "op11",
            operationType: "QUERY",
            name: "search",
            arguments: [
                {
                    name: "filter",
                    type: {
                        type: "alias",
                        value: {
                            type: "optional",
                            shape: idAlias("FilterInput")
                        }
                    },
                    defaultValue: undefined
                }
            ],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types });

        expect(result.variables).toEqual({
            filter: {
                field: "example",
                value: "example"
            }
        });
    });

    it("handles deeply nested objects with depth limiting", () => {
        // Create a chain of nested objects: Level1 -> Level2 -> Level3 -> Level4 -> Level5 -> Level6
        const types: Record<TypeId, TypeDefinition> = {
            [typeId("Level6")]: {
                name: "Level6",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [{ key: "deepValue", valueShape: primitiveAlias("string") }],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any,
            [typeId("Level5")]: {
                name: "Level5",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [{ key: "nested", valueShape: idAlias("Level6") }],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any,
            [typeId("Level4")]: {
                name: "Level4",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [{ key: "nested", valueShape: idAlias("Level5") }],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any,
            [typeId("Level3")]: {
                name: "Level3",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [{ key: "nested", valueShape: idAlias("Level4") }],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any,
            [typeId("Level2")]: {
                name: "Level2",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [{ key: "nested", valueShape: idAlias("Level3") }],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any,
            [typeId("Level1")]: {
                name: "Level1",
                shape: {
                    type: "object",
                    extends: [],
                    properties: [{ key: "nested", valueShape: idAlias("Level2") }],
                    extraProperties: undefined
                },
                description: undefined,
                availability: undefined
            } as any
        };

        const operation: GraphQlOperation = {
            id: "op12",
            operationType: "QUERY",
            name: "getDeep",
            arguments: [{ name: "input", type: idAlias("Level1"), defaultValue: undefined }],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types });

        // depth=5: Level1 (depth 5) -> Level2 (depth 4) -> Level3 (depth 3) -> Level4 (depth 2) -> Level5 (depth 1) -> Level6 (depth 0 = null)
        expect(result.variables).toEqual({
            input: {
                nested: {
                    nested: {
                        nested: {
                            nested: {
                                nested: null
                            }
                        }
                    }
                }
            }
        });
    });

    it("generates empty variables for operations without arguments", () => {
        const operation: GraphQlOperation = {
            id: "op13",
            operationType: "QUERY",
            name: "getStatus",
            arguments: [],
            returnType: primitiveAlias("string"),
            examples: undefined
        } as any;

        const result = generateGraphQlSnippet({ operation, types: {} });

        expect(result.variables).toEqual({});
    });
});
