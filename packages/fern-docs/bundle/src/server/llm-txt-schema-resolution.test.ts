import type { FernNavigation } from "@fern-api/fdr-sdk";
import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { describe, expect, it, vi } from "vitest";
import type { TypesResolver } from "./llm-txt-md";
import { resolveSchemaComponents } from "./llm-txt-md";

/**
 * Helper to create a mock TypeDefinition with an object shape.
 */
function createObjectTypeDef(
    name: string,
    properties: { key: string; type: string; description?: string; optional?: boolean; availability?: string }[],
    description?: string
): TypeDefinition {
    return {
        name,
        description,
        availability: undefined,
        displayName: undefined,
        shape: {
            type: "object",
            extends: [],
            extraProperties: undefined,
            properties: properties.map((prop) => ({
                key: prop.key as unknown as never,
                description: prop.description,
                availability: prop.availability,
                valueShape: prop.optional
                    ? { type: "optional" as const, shape: { type: "primitive" as const, value: { type: prop.type } } }
                    : { type: "primitive" as const, value: { type: prop.type } },
                propertyAccess: undefined
            }))
        }
    } as unknown as TypeDefinition;
}

/**
 * Helper to create a mock TypeDefinition with an enum shape.
 */
function createEnumTypeDef(
    name: string,
    values: { value: string; description?: string }[],
    description?: string
): TypeDefinition {
    return {
        name,
        description,
        availability: undefined,
        displayName: undefined,
        shape: {
            type: "enum",
            default: undefined,
            values: values.map((v) => ({
                value: v.value,
                description: v.description,
                availability: undefined
            }))
        }
    } as unknown as TypeDefinition;
}

/**
 * Helper to create a mock TypeDefinition with an alias shape.
 */
function createAliasTypeDef(name: string, aliasType: string, description?: string): TypeDefinition {
    return {
        name,
        description,
        availability: undefined,
        displayName: undefined,
        shape: {
            type: "alias",
            value: { type: "primitive" as const, value: { type: aliasType } }
        }
    } as unknown as TypeDefinition;
}

/**
 * Helper to create a mock TypeDefinition with an undiscriminated union shape.
 */
function createUndiscriminatedUnionTypeDef(
    name: string,
    variants: { type: string; description?: string }[],
    description?: string
): TypeDefinition {
    return {
        name,
        description,
        availability: undefined,
        displayName: undefined,
        shape: {
            type: "undiscriminatedUnion",
            variants: variants.map((v) => ({
                displayName: undefined,
                availability: undefined,
                description: v.description,
                shape: { type: "primitive" as const, value: { type: v.type } }
            }))
        }
    } as unknown as TypeDefinition;
}

function createMockTypes(typeDefs: TypeDefinition[]): Record<FernNavigation.TypeId, TypeDefinition> {
    const types: Record<string, TypeDefinition> = {};
    for (let i = 0; i < typeDefs.length; i++) {
        const typeDef = typeDefs[i];
        if (typeDef != null) {
            types[`type_${i}` as FernNavigation.TypeId] = typeDef;
        }
    }
    return types as Record<FernNavigation.TypeId, TypeDefinition>;
}

function createMockResolver(typeDefs: TypeDefinition[], apiName?: string): TypesResolver {
    const types = createMockTypes(typeDefs);
    return vi.fn(async (requestedApi?: string) => {
        if (apiName != null && requestedApi !== apiName) {
            // If apiName is specified, only return for matching API
            if (requestedApi == null) {
                return types;
            }
            return undefined;
        }
        return types;
    });
}

describe("resolveSchemaComponents", () => {
    describe("passthrough behavior", () => {
        it("should return markdown unchanged when no schema components are present for 'md' format", async () => {
            const markdown = "# Hello\n\nSome regular content.";
            const resolver = vi.fn();
            const result = await resolveSchemaComponents(markdown, "md", resolver);
            expect(result).toContain("# Hello");
            expect(resolver).not.toHaveBeenCalled();
        });

        it("should return markdown unchanged when no schema components are present", async () => {
            const markdown = "# Hello\n\nSome regular content with **bold** and *italic* text.";
            const resolver = vi.fn();
            const result = await resolveSchemaComponents(markdown, "mdx", resolver);
            expect(result).toBe(markdown);
            expect(resolver).not.toHaveBeenCalled();
        });

        it("should remove schema components with no type attribute", async () => {
            const markdown = "# Hello\n\n<Schema />";
            const resolver = vi.fn(async () => ({})) as TypesResolver;
            const result = await resolveSchemaComponents(markdown, "mdx", resolver);
            expect(result).not.toContain("<Schema");
            expect(result).toContain("# Hello");
        });
    });

    describe("object type resolution", () => {
        it("should resolve a <Schema> component with an object type", async () => {
            const markdown = '# My Page\n\n<Schema type="User" />';
            const userType = createObjectTypeDef("User", [
                { key: "name", type: "string", description: "The user's name" },
                { key: "email", type: "string", description: "The user's email" }
            ]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### User");
            expect(result).toContain("**Properties:**");
            expect(result).toContain("`name`");
            expect(result).toContain("`email`");
            expect(result).toContain("The user's name");
            expect(result).toContain("The user's email");
            expect(result).not.toContain("<Schema");
        });

        it("should resolve a <Schema> component with type description", async () => {
            const markdown = '<Schema type="Config" />';
            const configType = createObjectTypeDef(
                "Config",
                [{ key: "timeout", type: "integer" }],
                "Configuration options for the API client."
            );
            const resolver = createMockResolver([configType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### Config");
            expect(result).toContain("Configuration options for the API client.");
            expect(result).toContain("`timeout`");
        });
    });

    describe("enum type resolution", () => {
        it("should resolve a <Schema> component with an enum type", async () => {
            const markdown = '<Schema type="Status" />';
            const statusType = createEnumTypeDef("Status", [
                { value: "active", description: "The resource is active" },
                { value: "inactive", description: "The resource is inactive" },
                { value: "pending" }
            ]);
            const resolver = createMockResolver([statusType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### Status");
            expect(result).toContain("**Enum values:**");
            expect(result).toContain("`active`");
            expect(result).toContain("`inactive`");
            expect(result).toContain("`pending`");
            expect(result).toContain("The resource is active");
            expect(result).toContain("The resource is inactive");
            expect(result).not.toContain("<Schema");
        });
    });

    describe("alias type resolution", () => {
        it("should resolve a <Schema> component with an alias type", async () => {
            const markdown = '<Schema type="UserId" />';
            const aliasType = createAliasTypeDef("UserId", "string", "A unique user identifier.");
            const resolver = createMockResolver([aliasType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### UserId");
            expect(result).toContain("A unique user identifier.");
            expect(result).toContain("**Type:** string");
            expect(result).not.toContain("<Schema");
        });
    });

    describe("undiscriminated union type resolution", () => {
        it("should resolve a <Schema> component with an undiscriminated union", async () => {
            const markdown = '<Schema type="StringOrNumber" />';
            const unionType = createUndiscriminatedUnionTypeDef("StringOrNumber", [
                { type: "string", description: "A string value" },
                { type: "integer", description: "A numeric value" }
            ]);
            const resolver = createMockResolver([unionType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### StringOrNumber");
            expect(result).toContain("**One of:**");
            expect(result).toContain("string");
            expect(result).toContain("integer");
            expect(result).not.toContain("<Schema");
        });
    });

    describe("component names", () => {
        it("should resolve <SchemaSnippet> components", async () => {
            const markdown = '<SchemaSnippet type="User" />';
            const userType = createObjectTypeDef("User", [{ key: "id", type: "string" }]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### User");
            expect(result).toContain("`id`");
            expect(result).not.toContain("<SchemaSnippet");
        });

        it("should resolve <RequestSchema> components", async () => {
            const markdown = '<RequestSchema type="CreateUserRequest" />';
            const requestType = createObjectTypeDef("CreateUserRequest", [
                { key: "name", type: "string" },
                { key: "email", type: "string" }
            ]);
            const resolver = createMockResolver([requestType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### CreateUserRequest");
            expect(result).toContain("`name`");
            expect(result).toContain("`email`");
            expect(result).not.toContain("<RequestSchema");
        });

        it("should resolve <ResponseSchema> components", async () => {
            const markdown = '<ResponseSchema type="UserResponse" />';
            const responseType = createObjectTypeDef("UserResponse", [
                { key: "id", type: "string" },
                { key: "created_at", type: "string" }
            ]);
            const resolver = createMockResolver([responseType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### UserResponse");
            expect(result).toContain("`id`");
            expect(result).toContain("`created_at`");
            expect(result).not.toContain("<ResponseSchema");
        });

        it("should resolve <EndpointSchemaSnippet> components with type prop", async () => {
            const markdown = '<EndpointSchemaSnippet type="Endpoint" />';
            const endpointType = createObjectTypeDef("Endpoint", [{ key: "url", type: "string" }]);
            const resolver = createMockResolver([endpointType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### Endpoint");
            expect(result).toContain("`url`");
            expect(result).not.toContain("<EndpointSchemaSnippet");
        });

        it("should remove <EndpointSchemaSnippet> without type prop", async () => {
            const markdown = '<EndpointSchemaSnippet endpoint="GET /users" />';
            const resolver = vi.fn(async () => ({})) as TypesResolver;

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).not.toContain("<EndpointSchemaSnippet");
        });
    });

    describe("multiple schema components", () => {
        it("should resolve multiple schema components in one document", async () => {
            const markdown = [
                "# API Reference",
                "",
                "## Create User",
                "",
                '<RequestSchema type="CreateUserRequest" />',
                "",
                "## Response",
                "",
                '<ResponseSchema type="UserResponse" />'
            ].join("\n");

            const requestType = createObjectTypeDef("CreateUserRequest", [
                { key: "name", type: "string" },
                { key: "email", type: "string" }
            ]);
            const responseType = createObjectTypeDef("UserResponse", [
                { key: "id", type: "string" },
                { key: "status", type: "string" }
            ]);
            const resolver = createMockResolver([requestType, responseType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### CreateUserRequest");
            expect(result).toContain("`name`");
            expect(result).toContain("`email`");
            expect(result).toContain("### UserResponse");
            expect(result).toContain("`id`");
            expect(result).toContain("`status`");
            expect(result).not.toContain("<RequestSchema");
            expect(result).not.toContain("<ResponseSchema");
        });

        it("should resolve duplicate schema component references", async () => {
            const markdown = [
                '<Schema type="Status" />',
                "",
                "Some text in between.",
                "",
                '<Schema type="Status" />'
            ].join("\n");

            const statusType = createEnumTypeDef("Status", [{ value: "active" }, { value: "inactive" }]);
            const resolver = createMockResolver([statusType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            // Both instances should be resolved
            const matches = result.match(/### Status/g);
            expect(matches).toHaveLength(2);
            expect(result).not.toContain("<Schema");
        });
    });

    describe("api attribute handling", () => {
        it("should pass apiName to the resolver when api attribute is specified", async () => {
            const markdown = '<Schema type="User" api="my-api" />';
            const userType = createObjectTypeDef("User", [{ key: "id", type: "string" }]);
            const types = createMockTypes([userType]);
            const resolver = vi.fn(async (apiName?: string) => {
                if (apiName === "my-api") {
                    return types;
                }
                return undefined;
            }) as TypesResolver;

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(resolver).toHaveBeenCalledWith("my-api");
            expect(result).toContain("### User");
        });

        it("should call resolver without apiName when api attribute is absent", async () => {
            const markdown = '<Schema type="User" />';
            const userType = createObjectTypeDef("User", [{ key: "id", type: "string" }]);
            const resolver = createMockResolver([userType]);

            await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(resolver).toHaveBeenCalledWith(undefined);
        });
    });

    describe("unresolvable types", () => {
        it("should show fallback text when resolver returns undefined", async () => {
            const markdown = '# Page\n\n<Schema type="NonExistentType" />\n\nAfter.';
            const resolver = vi.fn(async () => undefined) as TypesResolver;

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).not.toContain("<Schema");
            expect(result).toContain("See type: NonExistentType");
            expect(result).toContain("# Page");
            expect(result).toContain("After.");
        });

        it("should show fallback text when type name doesn't match any definition", async () => {
            const markdown = '# Page\n\n<Schema type="UnknownType" />\n\nAfter.';
            const otherType = createObjectTypeDef("OtherType", [{ key: "id", type: "string" }]);
            const resolver = createMockResolver([otherType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("See type: UnknownType");
            expect(result).not.toContain("<Schema");
            expect(result).toContain("# Page");
            expect(result).toContain("After.");
        });

        it("should handle resolver errors gracefully with fallback text", async () => {
            const markdown = '<Schema type="User" />';
            const resolver = vi.fn(async () => {
                throw new Error("Network error");
            }) as TypesResolver;

            // Should not throw
            const result = await resolveSchemaComponents(markdown, "mdx", resolver);
            expect(result).not.toContain("<Schema");
            expect(result).toContain("See type: User");
        });
    });

    describe("surrounding content preservation", () => {
        it("should preserve surrounding markdown content", async () => {
            const markdown = [
                "# Introduction",
                "",
                "This is some introductory text.",
                "",
                '<Schema type="User" />',
                "",
                "## Conclusion",
                "",
                "This is the conclusion."
            ].join("\n");

            const userType = createObjectTypeDef("User", [{ key: "id", type: "string" }]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("# Introduction");
            expect(result).toContain("This is some introductory text.");
            expect(result).toContain("### User");
            expect(result).toContain("## Conclusion");
            expect(result).toContain("This is the conclusion.");
        });
    });

    describe("nested type resolution", () => {
        it("should resolve a schema with properties referencing other types by ID", async () => {
            const markdown = '<Schema type="Order" />';

            // Address type that will be referenced by the Order type
            const addressType: TypeDefinition = {
                name: "Address",
                description: "A mailing address.",
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "object",
                    extends: [],
                    extraProperties: undefined,
                    properties: [
                        {
                            key: "street" as unknown as never,
                            description: "Street address line",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "string" } },
                            propertyAccess: undefined
                        },
                        {
                            key: "city" as unknown as never,
                            description: "City name",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "string" } },
                            propertyAccess: undefined
                        },
                        {
                            key: "zip" as unknown as never,
                            description: "ZIP or postal code",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "string" } },
                            propertyAccess: undefined
                        }
                    ]
                }
            } as unknown as TypeDefinition;

            // Order type with a nested reference to Address via type ID
            const orderType: TypeDefinition = {
                name: "Order",
                description: "A customer order.",
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "object",
                    extends: [],
                    extraProperties: undefined,
                    properties: [
                        {
                            key: "id" as unknown as never,
                            description: "Unique order identifier",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "string" } },
                            propertyAccess: undefined
                        },
                        {
                            key: "amount" as unknown as never,
                            description: "Total amount in cents",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "integer" } },
                            propertyAccess: undefined
                        },
                        {
                            key: "shipping_address" as unknown as never,
                            description: "Where to ship the order",
                            availability: undefined,
                            // This references the Address type by ID
                            valueShape: { type: "id" as const, id: "address_type_id" },
                            propertyAccess: undefined
                        },
                        {
                            key: "billing_address" as unknown as never,
                            description: "Billing address for the order",
                            availability: undefined,
                            // This references Address as an optional nested type
                            valueShape: {
                                type: "optional" as const,
                                shape: { type: "id" as const, id: "address_type_id" }
                            },
                            propertyAccess: undefined
                        },
                        {
                            key: "items" as unknown as never,
                            description: "Line items in the order",
                            availability: undefined,
                            // List of a nested type
                            valueShape: {
                                type: "list" as const,
                                itemShape: { type: "id" as const, id: "line_item_type_id" }
                            },
                            propertyAccess: undefined
                        }
                    ]
                }
            } as unknown as TypeDefinition;

            // LineItem type
            const lineItemType: TypeDefinition = {
                name: "LineItem",
                description: "A single item in an order.",
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "object",
                    extends: [],
                    extraProperties: undefined,
                    properties: [
                        {
                            key: "product_name" as unknown as never,
                            description: "Name of the product",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "string" } },
                            propertyAccess: undefined
                        },
                        {
                            key: "quantity" as unknown as never,
                            description: "Number of units",
                            availability: undefined,
                            valueShape: { type: "primitive" as const, value: { type: "integer" } },
                            propertyAccess: undefined
                        }
                    ]
                }
            } as unknown as TypeDefinition;

            // Build the types map with explicit IDs matching the references
            const types: Record<string, TypeDefinition> = {
                order_type_id: orderType,
                address_type_id: addressType,
                line_item_type_id: lineItemType
            };

            const resolver = vi.fn(async () => types) as unknown as TypesResolver;

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            // The Order type should be resolved
            expect(result).toContain("### Order");
            expect(result).toContain("A customer order.");
            expect(result).toContain("**Properties:**");

            // Primitive properties should show their types
            expect(result).toContain("`id`");
            expect(result).toContain("string");
            expect(result).toContain("`amount`");
            expect(result).toContain("integer");

            // Nested type references should show the resolved type shape
            expect(result).toContain("`shipping_address`");
            expect(result).toContain("object");
            expect(result).toContain("Where to ship the order");

            // Sub-properties of the nested Address type should be rendered inline
            expect(result).toContain("`street`");
            expect(result).toContain("Street address line");
            expect(result).toContain("`city`");
            expect(result).toContain("City name");
            expect(result).toContain("`zip`");
            expect(result).toContain("ZIP or postal code");

            // Optional nested type should show the type name with optional (only once)
            expect(result).toContain("`billing_address`");
            expect(result).toContain("(optional)");
            // Verify no double (optional) — the word should appear exactly once per optional property
            const billingLine = result.split("\n").find((l: string) => l.includes("`billing_address`"));
            expect(billingLine).toBeDefined();
            const optionalCount = (billingLine!.match(/\(optional\)/g) || []).length;
            expect(optionalCount).toBe(1);

            // List of nested type should show "list of" with resolved inner type
            expect(result).toContain("`items`");
            expect(result).toContain("list of");

            // Sub-properties of LineItem should be rendered under items
            expect(result).toContain("`product_name`");
            expect(result).toContain("Name of the product");
            expect(result).toContain("`quantity`");
            expect(result).toContain("Number of units");

            // The raw Schema component should be gone
            expect(result).not.toContain("<Schema");
        });
    });

    describe("inline type detail for referenced types", () => {
        it("should show inline enum values for a property referencing an enum type", async () => {
            const markdown = '<Schema type="Plant" />';

            // PlantStatus enum type
            const plantStatusType: TypeDefinition = {
                name: "PlantStatus",
                description: undefined,
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "enum",
                    default: undefined,
                    values: [
                        { value: "healthy", description: undefined, availability: undefined },
                        { value: "wilting", description: undefined, availability: undefined },
                        { value: "dead", description: undefined, availability: undefined }
                    ]
                }
            } as unknown as TypeDefinition;

            // Plant type with properties referencing PlantStatus
            const plantType: TypeDefinition = {
                name: "Plant",
                description: undefined,
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "object",
                    extends: [],
                    extraProperties: undefined,
                    properties: [
                        {
                            key: "name" as unknown as never,
                            description: "The plant's name",
                            availability: undefined,
                            valueShape: {
                                type: "optional" as const,
                                shape: { type: "primitive" as const, value: { type: "string" } }
                            },
                            propertyAccess: undefined
                        },
                        {
                            key: "status" as unknown as never,
                            description: "Current status",
                            availability: undefined,
                            valueShape: {
                                type: "optional" as const,
                                shape: { type: "id" as const, id: "plant_status_id" }
                            },
                            propertyAccess: undefined
                        }
                    ]
                }
            } as unknown as TypeDefinition;

            const types: Record<string, TypeDefinition> = {
                plant_type_id: plantType,
                plant_status_id: plantStatusType
            };

            const resolver = vi.fn(async () => types) as unknown as TypesResolver;
            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### Plant");
            // status property should show inline enum values
            expect(result).toContain("`status`");
            expect(result).toContain("one of:");
            expect(result).toContain("`healthy`");
            expect(result).toContain("`wilting`");
            expect(result).toContain("`dead`");

            // name should NOT have double (optional)
            const nameLine = result.split("\n").find((l: string) => l.includes("`name`"));
            expect(nameLine).toBeDefined();
            expect((nameLine!.match(/\(optional\)/g) || []).length).toBe(1);

            // status should NOT have double (optional)
            const statusLine = result.split("\n").find((l: string) => l.includes("`status`"));
            expect(statusLine).toBeDefined();
            expect((statusLine!.match(/\(optional\)/g) || []).length).toBe(1);
        });

        it("should show inline values for undiscriminated union referenced types", async () => {
            const markdown = '<Schema type="Config" />';

            const valueUnionType: TypeDefinition = {
                name: "ConfigValue",
                description: undefined,
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "undiscriminatedUnion",
                    variants: [
                        {
                            displayName: undefined,
                            availability: undefined,
                            description: undefined,
                            shape: { type: "primitive" as const, value: { type: "string" } }
                        },
                        {
                            displayName: undefined,
                            availability: undefined,
                            description: undefined,
                            shape: { type: "primitive" as const, value: { type: "integer" } }
                        }
                    ]
                }
            } as unknown as TypeDefinition;

            const configType: TypeDefinition = {
                name: "Config",
                description: undefined,
                availability: undefined,
                displayName: undefined,
                shape: {
                    type: "object",
                    extends: [],
                    extraProperties: undefined,
                    properties: [
                        {
                            key: "value" as unknown as never,
                            description: "The config value",
                            availability: undefined,
                            valueShape: { type: "id" as const, id: "value_union_id" },
                            propertyAccess: undefined
                        }
                    ]
                }
            } as unknown as TypeDefinition;

            const types: Record<string, TypeDefinition> = {
                config_id: configType,
                value_union_id: valueUnionType
            };

            const resolver = vi.fn(async () => types) as unknown as TypesResolver;
            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("`value`");
            expect(result).toContain("one of:");
            expect(result).toContain("string");
            expect(result).toContain("integer");
        });
    });

    describe("md format schema resolution", () => {
        it("should resolve schema components in 'md' format", async () => {
            const markdown = '# My Page\n\n<Schema type="User" />';
            const userType = createObjectTypeDef("User", [
                { key: "name", type: "string", description: "The user's name" },
                { key: "email", type: "string", description: "The user's email" }
            ]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "md", resolver);

            expect(result).toContain("### User");
            expect(result).toContain("**Properties:**");
            expect(result).toContain("`name`");
            expect(result).toContain("`email`");
            expect(result).toContain("The user's name");
            expect(result).not.toContain("<Schema");
        });

        it("should resolve multiple schema components in 'md' format", async () => {
            const markdown = [
                "# API Types",
                "",
                '<Schema type="Status" />',
                "",
                '<RequestSchema type="CreateUser" />'
            ].join("\n");

            const statusType = createEnumTypeDef("Status", [{ value: "active" }, { value: "inactive" }]);
            const createUserType = createObjectTypeDef("CreateUser", [{ key: "name", type: "string" }]);
            const resolver = createMockResolver([statusType, createUserType]);

            const result = await resolveSchemaComponents(markdown, "md", resolver);

            expect(result).toContain("### Status");
            expect(result).toContain("**Enum values:**");
            expect(result).toContain("### CreateUser");
            expect(result).toContain("`name`");
            expect(result).not.toContain("<Schema");
            expect(result).not.toContain("<RequestSchema");
        });
    });

    describe("non-schema components", () => {
        it("should not affect non-schema MDX components", async () => {
            const markdown = [
                "# Hello",
                "",
                "<Callout>This is a callout.</Callout>",
                "",
                '<Schema type="User" />'
            ].join("\n");

            const userType = createObjectTypeDef("User", [{ key: "id", type: "string" }]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("### User");
            // The callout should still be there in some form
            expect(result).toContain("This is a callout.");
        });
    });

    describe("include/exclude/excludeDeprecated filtering", () => {
        it("should only include properties listed in include", async () => {
            const markdown = '<Schema type="User" include={["name"]} />';
            const userType = createObjectTypeDef("User", [
                { key: "name", type: "string", description: "The user's name" },
                { key: "email", type: "string", description: "The user's email" },
                { key: "id", type: "string", description: "The user's ID" }
            ]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("`name`");
            expect(result).not.toContain("`email`");
            expect(result).not.toContain("`id`");
        });

        it("should exclude properties listed in exclude", async () => {
            const markdown = '<Schema type="User" exclude={["email"]} />';
            const userType = createObjectTypeDef("User", [
                { key: "name", type: "string", description: "The user's name" },
                { key: "email", type: "string", description: "The user's email" },
                { key: "id", type: "string", description: "The user's ID" }
            ]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("`name`");
            expect(result).toContain("`id`");
            expect(result).not.toContain("`email`");
        });

        it("should exclude deprecated properties when excludeDeprecated is set", async () => {
            const markdown = '<Schema type="User" excludeDeprecated />';
            const userType = createObjectTypeDef("User", [
                { key: "name", type: "string", description: "The user's name" },
                { key: "old_field", type: "string", description: "Deprecated field", availability: "Deprecated" }
            ]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            expect(result).toContain("`name`");
            expect(result).not.toContain("`old_field`");
        });

        it("should use different cache keys for same type with different filters", async () => {
            const markdown = [
                '<Schema type="User" include={["name"]} />',
                "",
                '<Schema type="User" include={["email"]} />'
            ].join("\n");
            const userType = createObjectTypeDef("User", [
                { key: "name", type: "string" },
                { key: "email", type: "string" }
            ]);
            const resolver = createMockResolver([userType]);

            const result = await resolveSchemaComponents(markdown, "mdx", resolver);

            // Both filtered versions should appear
            expect(result).toContain("`name`");
            expect(result).toContain("`email`");
        });
    });
});
