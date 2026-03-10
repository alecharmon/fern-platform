import type { OpenAPISchema } from "./openapi-types.js";

/**
 * Infers an OpenAPI schema from a JSON value.
 */
export function inferSchema(value: unknown): OpenAPISchema {
    if (value === null) {
        return { type: ["null"] };
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return { type: "array", items: {} };
        }
        const itemSchema = inferSchema(value[0]);
        return { type: "array", items: itemSchema };
    }

    switch (typeof value) {
        case "string":
            return inferStringSchema(value);
        case "number":
            return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
        case "boolean":
            return { type: "boolean" };
        case "object":
            return inferObjectSchema(value as Record<string, unknown>);
        default:
            return {};
    }
}

/**
 * Infers a string schema, detecting common formats.
 */
function inferStringSchema(value: string): OpenAPISchema {
    if (isDateTimeString(value)) {
        return { type: "string", format: "date-time" };
    }
    if (isDateString(value)) {
        return { type: "string", format: "date" };
    }
    if (isEmailString(value)) {
        return { type: "string", format: "email" };
    }
    if (isUuidString(value)) {
        return { type: "string", format: "uuid" };
    }
    if (isUrlString(value)) {
        return { type: "string", format: "uri" };
    }
    return { type: "string" };
}

/**
 * Valid JSON Schema type values.
 */
const VALID_SCHEMA_TYPES = new Set(["string", "number", "integer", "boolean", "array", "object", "null"]);

/**
 * Checks if an object looks like a JSON Schema / OpenAPI schema definition
 * rather than a plain data object. This handles cases where Postman examples
 * contain values that are themselves schema definitions (e.g. from Tableau APIs).
 */
function looksLikeSchemaDefinition(obj: Record<string, unknown>): boolean {
    const typeValue = obj.type;
    if (typeof typeValue !== "string" || !VALID_SCHEMA_TYPES.has(typeValue)) {
        return false;
    }

    // An object with a valid `type` AND schema-specific structural keywords is likely a schema
    const hasProperties =
        typeof obj.properties === "object" && obj.properties !== null && !Array.isArray(obj.properties);
    const hasItems = typeof obj.items === "object" && obj.items !== null;
    const hasEnum = Array.isArray(obj.enum);
    const hasOneOf = Array.isArray(obj.oneOf);
    const hasAnyOf = Array.isArray(obj.anyOf);
    const hasAllOf = Array.isArray(obj.allOf);

    return hasProperties || hasItems || hasEnum || hasOneOf || hasAnyOf || hasAllOf;
}

/**
 * Converts an object that looks like a JSON Schema definition into an OpenAPISchema,
 * recursively handling nested schema-like objects within `properties` and `items`.
 */
function convertSchemaLikeObject(obj: Record<string, unknown>): OpenAPISchema {
    const schema: OpenAPISchema = {};

    if (typeof obj.type === "string") {
        schema.type = obj.type;
    }

    if (typeof obj.format === "string") {
        schema.format = obj.format;
    }

    if (typeof obj.description === "string") {
        schema.description = obj.description;
    }

    if (obj.default !== undefined) {
        schema.default = obj.default;
    }

    if (Array.isArray(obj.required)) {
        schema.required = obj.required.filter((r): r is string => typeof r === "string");
    }

    if (Array.isArray(obj.enum)) {
        schema.enum = obj.enum;
    }

    if (typeof obj.properties === "object" && obj.properties !== null && !Array.isArray(obj.properties)) {
        const properties: Record<string, OpenAPISchema> = {};
        for (const [key, val] of Object.entries(obj.properties as Record<string, unknown>)) {
            if (
                typeof val === "object" &&
                val !== null &&
                !Array.isArray(val) &&
                looksLikeSchemaDefinition(val as Record<string, unknown>)
            ) {
                properties[key] = convertSchemaLikeObject(val as Record<string, unknown>);
            } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
                // Might be a simple schema like { "type": "string" }
                const valObj = val as Record<string, unknown>;
                if (typeof valObj.type === "string" && VALID_SCHEMA_TYPES.has(valObj.type)) {
                    properties[key] = convertSchemaLikeObject(valObj);
                } else {
                    properties[key] = inferSchema(val);
                }
            } else {
                properties[key] = inferSchema(val);
            }
        }
        schema.properties = properties;
    }

    if (typeof obj.items === "object" && obj.items !== null && !Array.isArray(obj.items)) {
        const itemsObj = obj.items as Record<string, unknown>;
        if (looksLikeSchemaDefinition(itemsObj)) {
            schema.items = convertSchemaLikeObject(itemsObj);
        } else if (typeof itemsObj.type === "string" && VALID_SCHEMA_TYPES.has(itemsObj.type)) {
            schema.items = convertSchemaLikeObject(itemsObj);
        } else {
            schema.items = inferSchema(obj.items);
        }
    }

    return schema;
}

/**
 * Infers an object schema from key-value pairs.
 */
function inferObjectSchema(obj: Record<string, unknown>): OpenAPISchema {
    // Detect objects that look like JSON Schema definitions and pass them through
    if (looksLikeSchemaDefinition(obj)) {
        return convertSchemaLikeObject(obj);
    }

    const properties: Record<string, OpenAPISchema> = {};
    const requiredKeys: string[] = [];

    for (const [key, val] of Object.entries(obj)) {
        properties[key] = inferSchema(val);
        if (val != null) {
            requiredKeys.push(key);
        }
    }

    const schema: OpenAPISchema = { type: "object", properties };
    if (requiredKeys.length > 0) {
        schema.required = requiredKeys;
    }
    return schema;
}

/**
 * Infers a schema from a JSON string body, returning schema and parsed example.
 */
export function inferSchemaFromJsonString(body: string): { schema: OpenAPISchema; example: unknown } | undefined {
    try {
        const parsed: unknown = JSON.parse(body);
        return { schema: inferSchema(parsed), example: parsed };
    } catch {
        return undefined;
    }
}

interface XmlElement {
    tagName: string;
    attributes: Record<string, string>;
    children: XmlElement[];
    textContent: string | undefined;
}

/**
 * Infers an OpenAPI schema from an XML string body.
 * Parses the XML structure and generates a schema with proper types
 * instead of treating the entire XML as a plain string.
 */
export function inferSchemaFromXmlString(body: string): { schema: OpenAPISchema; example: string } | undefined {
    const trimmed = body.trim();
    if (!trimmed.startsWith("<")) {
        return undefined;
    }

    const root = parseXmlElement(trimmed);
    if (!root) {
        return undefined;
    }

    const schema = inferXmlElementSchema(root);
    return { schema, example: body };
}

/**
 * Simple XML parser that extracts the element tree structure.
 * Handles self-closing tags, attributes, nested elements, and text content.
 * Skips XML declarations (<?xml ...?>) and comments (<!-- ... -->).
 */
function parseXmlElement(xml: string): XmlElement | undefined {
    let pos = 0;

    function skipWhitespace(): void {
        while (pos < xml.length && /\s/.test(xml[pos]!)) {
            pos++;
        }
    }

    function skipDeclarationsAndComments(): void {
        while (pos < xml.length) {
            skipWhitespace();
            if (xml.startsWith("<?", pos)) {
                const end = xml.indexOf("?>", pos);
                if (end === -1) {
                    break;
                }
                pos = end + 2;
            } else if (xml.startsWith("<!--", pos)) {
                const end = xml.indexOf("-->", pos);
                if (end === -1) {
                    break;
                }
                pos = end + 3;
            } else {
                break;
            }
        }
    }

    function parseElement(): XmlElement | undefined {
        skipDeclarationsAndComments();
        skipWhitespace();

        if (pos >= xml.length || xml[pos] !== "<") {
            return undefined;
        }

        pos++; // skip '<'
        const tagStart = pos;

        // Read tag name
        while (pos < xml.length && !/[\s/>]/.test(xml[pos]!)) {
            pos++;
        }
        const tagName = xml.slice(tagStart, pos);
        if (!tagName || tagName.startsWith("/")) {
            return undefined;
        }

        // Parse attributes
        const attributes: Record<string, string> = {};
        while (pos < xml.length) {
            skipWhitespace();
            if (xml[pos] === "/" || xml[pos] === ">") {
                break;
            }

            const attrStart = pos;
            while (pos < xml.length && !/[\s=/>]/.test(xml[pos]!)) {
                pos++;
            }
            const attrName = xml.slice(attrStart, pos);
            skipWhitespace();

            if (xml[pos] === "=") {
                pos++; // skip '='
                skipWhitespace();
                const quote = xml[pos];
                if (quote === '"' || quote === "'") {
                    pos++; // skip opening quote
                    const valStart = pos;
                    while (pos < xml.length && xml[pos] !== quote) {
                        pos++;
                    }
                    attributes[attrName] = xml.slice(valStart, pos);
                    pos++; // skip closing quote
                }
            }
        }

        // Self-closing tag
        if (xml[pos] === "/") {
            pos++; // skip '/'
            if (xml[pos] === ">") {
                pos++; // skip '>'
            }
            return { tagName, attributes, children: [], textContent: undefined };
        }

        pos++; // skip '>'

        // Parse children and text content
        const children: XmlElement[] = [];
        let textContent = "";

        while (pos < xml.length) {
            // Check for closing tag
            if (xml.startsWith(`</${tagName}`, pos)) {
                pos += tagName.length + 3; // skip '</tagName>'
                break;
            }

            // Check for a more general closing tag match (handles whitespace before >)
            if (xml.startsWith("</", pos)) {
                const closeEnd = xml.indexOf(">", pos);
                if (closeEnd !== -1) {
                    pos = closeEnd + 1;
                }
                break;
            }

            // Skip comments inside elements
            if (xml.startsWith("<!--", pos)) {
                const end = xml.indexOf("-->", pos);
                if (end === -1) {
                    break;
                }
                pos = end + 3;
                continue;
            }

            // Try to parse a child element
            if (xml[pos] === "<") {
                const child = parseElement();
                if (child) {
                    children.push(child);
                } else {
                    break;
                }
            } else {
                // Collect text content
                const textStart = pos;
                while (pos < xml.length && xml[pos] !== "<") {
                    pos++;
                }
                textContent += xml.slice(textStart, pos);
            }
        }

        const trimmedText = textContent.trim();
        return {
            tagName,
            attributes,
            children,
            textContent: trimmedText.length > 0 ? trimmedText : undefined
        };
    }

    return parseElement();
}

/**
 * Infers an OpenAPI schema from a parsed XML element.
 *
 * Mapping rules:
 * - Element with child elements → object with properties
 * - Multiple sibling elements with the same tag → array
 * - Element with only text content → inferred primitive type
 * - Element attributes become string properties prefixed with `@`
 */
function inferXmlElementSchema(element: XmlElement): OpenAPISchema {
    const hasAttributes = Object.keys(element.attributes).length > 0;
    const hasChildren = element.children.length > 0;
    const hasText = element.textContent != null;

    // Leaf element with no attributes: infer primitive type from text
    if (!hasChildren && !hasAttributes) {
        if (!hasText) {
            return { type: "string" };
        }
        return inferPrimitiveFromText(element.textContent!);
    }

    // Element with children or attributes → object
    const properties: Record<string, OpenAPISchema> = {};
    const requiredKeys: string[] = [];

    // Add attributes as string properties with @ prefix
    for (const [attrName, _attrValue] of Object.entries(element.attributes)) {
        const propName = `@${attrName}`;
        properties[propName] = { type: "string" };
        requiredKeys.push(propName);
    }

    // If the element has both attributes and text content, add text as a #text property
    if (hasAttributes && hasText) {
        properties["#text"] = inferPrimitiveFromText(element.textContent!);
        requiredKeys.push("#text");
    }

    // Group children by tag name to detect arrays
    const childGroups = new Map<string, XmlElement[]>();
    for (const child of element.children) {
        const existing = childGroups.get(child.tagName);
        if (existing) {
            existing.push(child);
        } else {
            childGroups.set(child.tagName, [child]);
        }
    }

    for (const [tagName, group] of childGroups) {
        const childSchema = inferXmlElementSchema(group[0]!);
        if (group.length > 1) {
            properties[tagName] = { type: "array", items: childSchema };
        } else {
            properties[tagName] = childSchema;
        }
        requiredKeys.push(tagName);
    }

    const schema: OpenAPISchema = { type: "object", properties };
    if (requiredKeys.length > 0) {
        schema.required = requiredKeys;
    }

    return schema;
}

/**
 * Infers a primitive OpenAPI type from a text string value.
 */
function inferPrimitiveFromText(text: string): OpenAPISchema {
    if (text === "true" || text === "false") {
        return { type: "boolean" };
    }
    if (/^-?\d+$/.test(text)) {
        return { type: "integer" };
    }
    if (/^-?\d+\.\d+$/.test(text)) {
        return { type: "number" };
    }
    return inferStringSchema(text);
}

function isDateTimeString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function isDateString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isEmailString(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuidString(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isUrlString(value: string): boolean {
    return /^https?:\/\//.test(value);
}
