import { describe, expect, it } from "vitest";

import { inferSchema, inferSchemaFromJsonString, inferSchemaFromXmlString } from "../schema-inference.js";

describe("inferSchema", () => {
    it("infers null as type array with null", () => {
        expect(inferSchema(null)).toEqual({ type: ["null"] });
    });

    it("infers string type", () => {
        expect(inferSchema("hello")).toEqual({ type: "string" });
    });

    it("infers integer type", () => {
        expect(inferSchema(42)).toEqual({ type: "integer" });
    });

    it("infers number type for floats", () => {
        expect(inferSchema(3.14)).toEqual({ type: "number" });
    });

    it("infers boolean type", () => {
        expect(inferSchema(true)).toEqual({ type: "boolean" });
    });

    it("infers date-time format", () => {
        expect(inferSchema("2024-01-15T10:30:00Z")).toEqual({ type: "string", format: "date-time" });
    });

    it("infers date format", () => {
        expect(inferSchema("2024-01-15")).toEqual({ type: "string", format: "date" });
    });

    it("infers email format", () => {
        expect(inferSchema("user@example.com")).toEqual({ type: "string", format: "email" });
    });

    it("infers uuid format", () => {
        expect(inferSchema("550e8400-e29b-41d4-a716-446655440000")).toEqual({ type: "string", format: "uuid" });
    });

    it("infers uri format", () => {
        expect(inferSchema("https://example.com")).toEqual({ type: "string", format: "uri" });
    });

    it("infers object with properties", () => {
        const result = inferSchema({ name: "John", age: 30 });
        expect(result).toEqual({
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "integer" }
            },
            required: ["name", "age"]
        });
    });

    it("excludes null values from required", () => {
        const result = inferSchema({ name: "John", nickname: null });
        expect(result.required).toEqual(["name"]);
    });

    it("infers array type", () => {
        const result = inferSchema([1, 2, 3]);
        expect(result).toEqual({
            type: "array",
            items: { type: "integer" }
        });
    });

    it("infers empty array", () => {
        expect(inferSchema([])).toEqual({
            type: "array",
            items: {}
        });
    });

    it("infers nested objects", () => {
        const result = inferSchema({
            user: { name: "John", email: "john@example.com" }
        });
        expect(result.properties?.user).toEqual({
            type: "object",
            properties: {
                name: { type: "string" },
                email: { type: "string", format: "email" }
            },
            required: ["name", "email"]
        });
    });

    it("detects schema-like objects with type+properties and passes them through", () => {
        const result = inferSchema({
            type: "object",
            properties: {
                id: {
                    type: "string",
                    default: "<string>",
                    description: "The LUID of the metric."
                }
            }
        });
        expect(result).toEqual({
            type: "object",
            properties: {
                id: {
                    type: "string",
                    default: "<string>",
                    description: "The LUID of the metric."
                }
            }
        });
    });

    it("detects schema-like objects with type+items and passes them through", () => {
        const result = inferSchema({
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" }
                }
            }
        });
        expect(result).toEqual({
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" }
                }
            }
        });
    });

    it("handles deeply nested schema-like example without infinite recursion (Tableau bug)", () => {
        const tableauExample = {
            offset: "<integer>",
            definitions: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        metrics: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: {
                                        type: "string",
                                        default: "<string>",
                                        description: "The LUID of the metric."
                                    },
                                    is_default: {
                                        type: "boolean",
                                        default: "<boolean>",
                                        description: "If true, the metric is the default metric."
                                    },
                                    definition_id: {
                                        type: "string",
                                        default: "<string>",
                                        description: "The LUID of the definition."
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        const result = inferSchema(tableauExample);

        // The top-level should be inferred as an object with offset and definitions
        expect(result.type).toBe("object");
        expect(result.properties?.offset).toEqual({ type: "string" });

        // definitions should be passed through as a schema definition, not recursively inferred
        const definitions = result.properties?.definitions;
        expect(definitions?.type).toBe("array");
        expect(definitions?.items?.type).toBe("object");

        // Verify metrics are preserved as schema structure
        const metrics = definitions?.items?.properties?.metrics;
        expect(metrics?.type).toBe("array");
        expect(metrics?.items?.type).toBe("object");
        expect(metrics?.items?.properties?.id?.type).toBe("string");
        expect(metrics?.items?.properties?.id?.description).toBe("The LUID of the metric.");
        expect(metrics?.items?.properties?.is_default?.type).toBe("boolean");

        // Ensure no infinite nesting — metrics.items.properties should NOT have type/properties keys repeating
        const idProp = metrics?.items?.properties?.id;
        expect(idProp?.properties).toBeUndefined();
        expect(idProp?.items).toBeUndefined();
    });

    it("does not treat plain objects with a 'type' key but no schema keywords as schemas", () => {
        const result = inferSchema({
            type: "premium",
            name: "Gold Plan"
        });
        // "premium" is not a valid schema type, so this is a regular object
        expect(result).toEqual({
            type: "object",
            properties: {
                type: { type: "string" },
                name: { type: "string" }
            },
            required: ["type", "name"]
        });
    });

    it("handles schema-like object with enum", () => {
        const result = inferSchema({
            type: "string",
            enum: ["active", "inactive", "pending"]
        });
        expect(result).toEqual({
            type: "string",
            enum: ["active", "inactive", "pending"]
        });
    });
});

describe("inferSchemaFromJsonString", () => {
    it("parses valid JSON and infers schema", () => {
        const result = inferSchemaFromJsonString('{"name": "John", "age": 30}');
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.example).toEqual({ name: "John", age: 30 });
    });

    it("returns undefined for invalid JSON", () => {
        expect(inferSchemaFromJsonString("not json")).toBeUndefined();
    });

    it("handles JSON arrays", () => {
        const result = inferSchemaFromJsonString('[{"id": 1}, {"id": 2}]');
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("array");
    });

    it("handles JSON primitives", () => {
        const result = inferSchemaFromJsonString('"hello"');
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("string");
    });
});

describe("inferSchemaFromXmlString", () => {
    it("returns undefined for non-XML string", () => {
        expect(inferSchemaFromXmlString("not xml")).toBeUndefined();
    });

    it("infers schema from simple XML element with text content", () => {
        const result = inferSchemaFromXmlString("<name>John</name>");
        expect(result).toBeDefined();
        expect(result!.schema).toEqual({ type: "string" });
        expect(result!.example).toBe("<name>John</name>");
    });

    it("infers object schema from XML with child elements", () => {
        const xml = "<user><name>John</name><age>30</age></user>";
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!.name).toEqual({ type: "string" });
        expect(result!.schema.properties!.age).toEqual({ type: "integer" });
        expect(result!.schema.required).toEqual(["name", "age"]);
    });

    it("infers array schema from repeated sibling elements", () => {
        const xml = "<users><user>Alice</user><user>Bob</user></users>";
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!.user).toEqual({
            type: "array",
            items: { type: "string" }
        });
    });

    it("infers nested object schema from deeply nested XML", () => {
        const xml = `<order>
            <id>123</id>
            <customer>
                <name>John</name>
                <email>john@example.com</email>
            </customer>
            <total>99.99</total>
        </order>`;
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!.id).toEqual({ type: "integer" });
        expect(result!.schema.properties!.total).toEqual({ type: "number" });
        expect(result!.schema.properties!.customer!.type).toBe("object");
        expect(result!.schema.properties!.customer!.properties!.name).toEqual({ type: "string" });
        expect(result!.schema.properties!.customer!.properties!.email).toEqual({
            type: "string",
            format: "email"
        });
    });

    it("handles XML attributes as @-prefixed properties", () => {
        const xml = '<item id="42" type="product"><name>Widget</name></item>';
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!["@id"]).toEqual({ type: "string" });
        expect(result!.schema.properties!["@type"]).toEqual({ type: "string" });
        expect(result!.schema.properties!.name).toEqual({ type: "string" });
    });

    it("handles self-closing tags", () => {
        const xml = "<root><empty/><name>Test</name></root>";
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!.empty).toEqual({ type: "string" });
        expect(result!.schema.properties!.name).toEqual({ type: "string" });
    });

    it("skips XML declarations", () => {
        const xml = '<?xml version="1.0" encoding="UTF-8"?><root><name>Test</name></root>';
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!.name).toEqual({ type: "string" });
    });

    it("infers boolean type from text content", () => {
        const xml = "<config><enabled>true</enabled><debug>false</debug></config>";
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.properties!.enabled).toEqual({ type: "boolean" });
        expect(result!.schema.properties!.debug).toEqual({ type: "boolean" });
    });

    it("handles XML with mixed child types", () => {
        const xml = `<response>
            <status>200</status>
            <message>OK</message>
            <items>
                <item><id>1</id><name>First</name></item>
                <item><id>2</id><name>Second</name></item>
            </items>
        </response>`;
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!.status).toEqual({ type: "integer" });
        expect(result!.schema.properties!.message).toEqual({ type: "string" });
        expect(result!.schema.properties!.items!.type).toBe("object");
        expect(result!.schema.properties!.items!.properties!.item!.type).toBe("array");
        expect(result!.schema.properties!.items!.properties!.item!.items!.type).toBe("object");
    });

    it("handles element with both attributes and text content", () => {
        const xml = '<price currency="USD">19.99</price>';
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!["@currency"]).toEqual({ type: "string" });
        expect(result!.schema.properties!["#text"]).toEqual({ type: "number" });
    });

    it("handles XML comments", () => {
        const xml = "<root><!-- this is a comment --><name>Test</name></root>";
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.schema.properties!.name).toEqual({ type: "string" });
    });

    it("preserves the raw XML string as the example", () => {
        const xml = "<item><name>Test</name></item>";
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.example).toBe(xml);
    });

    it("handles a realistic SOAP-like XML body", () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Envelope>
    <Body>
        <CreateOrderRequest>
            <orderId>ORD-12345</orderId>
            <customer>
                <firstName>Jane</firstName>
                <lastName>Doe</lastName>
                <email>jane.doe@example.com</email>
            </customer>
            <lineItems>
                <lineItem>
                    <sku>SKU-001</sku>
                    <quantity>2</quantity>
                    <unitPrice>29.99</unitPrice>
                </lineItem>
                <lineItem>
                    <sku>SKU-002</sku>
                    <quantity>1</quantity>
                    <unitPrice>49.99</unitPrice>
                </lineItem>
            </lineItems>
            <shippingAddress>
                <street>123 Main St</street>
                <city>Springfield</city>
                <state>IL</state>
                <zip>62701</zip>
            </shippingAddress>
        </CreateOrderRequest>
    </Body>
</Envelope>`;
        const result = inferSchemaFromXmlString(xml);
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");

        const body = result!.schema.properties!.Body!;
        expect(body.type).toBe("object");

        const request = body.properties!.CreateOrderRequest!;
        expect(request.type).toBe("object");
        expect(request.properties!.orderId).toEqual({ type: "string" });

        const customer = request.properties!.customer!;
        expect(customer.type).toBe("object");
        expect(customer.properties!.email).toEqual({ type: "string", format: "email" });

        const lineItems = request.properties!.lineItems!;
        expect(lineItems.type).toBe("object");
        expect(lineItems.properties!.lineItem!.type).toBe("array");
        expect(lineItems.properties!.lineItem!.items!.properties!.quantity).toEqual({ type: "integer" });
        expect(lineItems.properties!.lineItem!.items!.properties!.unitPrice).toEqual({ type: "number" });

        const address = request.properties!.shippingAddress!;
        expect(address.type).toBe("object");
        expect(address.properties!.zip).toEqual({ type: "integer" });
    });
});
