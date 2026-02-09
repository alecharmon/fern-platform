import type { TypeId } from "../../navigation";
import type {
    GraphQlOperation,
    GraphQlOperationType,
    ObjectProperty,
    PrimitiveType,
    TypeDefinition,
    TypeReference,
    TypeShape
} from "../latest";

/**
 * Context needed to generate a GraphQL snippet
 */
export interface GraphQlSnippetContext {
    operation: GraphQlOperation;
    types: Record<TypeId, TypeDefinition>;
}

/**
 * Generated GraphQL snippet
 */
export interface GraphQlSnippet {
    query: string;
    variables: Record<string, unknown>;
    response: unknown;
}

// Cache for generated snippets to avoid regenerating on re-renders
const snippetCache = new WeakMap<GraphQlOperation, GraphQlSnippet>();

/**
 * Generate a GraphQL snippet from an operation definition
 */
export function generateGraphQlSnippet(context: GraphQlSnippetContext): GraphQlSnippet {
    const cached = snippetCache.get(context.operation);
    if (cached) {
        return cached;
    }
    const { operation, types } = context;

    const operationKeyword = getOperationKeyword(operation.operationType);
    const operationName = getExampleOperationName(operation.operationType);

    const args = operation.arguments ?? [];
    const variables: Record<string, unknown> = {};

    // Build variable definitions and collect example values
    const variableDefinitions = args.map((arg) => {
        const graphqlType = typeShapeToGraphQlType(arg.type, types);
        const exampleValue = generateExampleValue(arg.type, types, 5, new Set(), arg.defaultValue);
        variables[arg.name] = exampleValue;
        return `$${arg.name}: ${graphqlType}`;
    });

    // Build argument usage in the query
    const argumentUsage = args.map((arg) => `${arg.name}: $${arg.name}`);

    // Build the selection set from the return type
    const selectionSet = generateSelectionSet(operation.returnType, types, 2);

    // Construct the query
    let query = operationKeyword;
    if (operationName || variableDefinitions.length > 0) {
        query += ` ${operationName}`;
        if (variableDefinitions.length > 0) {
            query += `(${variableDefinitions.join(", ")})`;
        }
    }

    query += " {\n";
    query += `  ${operation.name}`;

    if (argumentUsage.length > 0) {
        query += `(${argumentUsage.join(", ")})`;
    }

    if (selectionSet) {
        query += ` ${selectionSet}`;
    }

    query += "\n}";

    // Generate example response based on return type
    const response = generateResponseExample(operation.name, operation.returnType, types);

    const result = { query, variables, response };
    snippetCache.set(operation, result);
    return result;
}

/**
 * Get the GraphQL operation keyword (query, mutation, subscription)
 */
function getOperationKeyword(operationType: GraphQlOperationType): string {
    switch (operationType) {
        case "QUERY":
            return "query";
        case "MUTATION":
            return "mutation";
        case "SUBSCRIPTION":
            return "subscription";
        default:
            return "query";
    }
}

/**
 * Get the example operation name based on operation type
 */
function getExampleOperationName(operationType: GraphQlOperationType): string {
    switch (operationType) {
        case "QUERY":
            return "ExampleQuery";
        case "MUTATION":
            return "ExampleMutation";
        case "SUBSCRIPTION":
            return "ExampleSubscription";
        default:
            return "ExampleQuery";
    }
}

/**
 * Convert a TypeShape to a GraphQL type string
 */
function typeShapeToGraphQlType(shape: TypeShape, types: Record<TypeId, TypeDefinition>): string {
    if (shape.type === "alias") {
        return typeReferenceToGraphQlType(shape.value, types);
    }
    if (shape.type === "enum") {
        return "String"; // Enums are typically strings in GraphQL
    }
    if (shape.type === "object") {
        return "Object"; // Generic object type
    }
    if (shape.type === "undiscriminatedUnion" || shape.type === "discriminatedUnion") {
        return "Object"; // Unions are complex types
    }
    return "String";
}

/**
 * Convert a TypeReference to a GraphQL type string
 */
function typeReferenceToGraphQlType(ref: TypeReference, types: Record<TypeId, TypeDefinition>): string {
    switch (ref.type) {
        case "primitive":
            return primitiveToGraphQlType(ref.value);
        case "id": {
            const typeDef = types[ref.id];
            if (typeDef) {
                return typeDef.displayName ?? unnamespacedName(typeDef.name) ?? "Object";
            }
            return "Object";
        }
        case "optional":
            return typeShapeToGraphQlType(ref.shape, types);
        case "nullable":
            return typeShapeToGraphQlType(ref.shape, types);
        case "list":
            return `[${typeShapeToGraphQlType(ref.itemShape, types)}]`;
        case "set":
            return `[${typeShapeToGraphQlType(ref.itemShape, types)}]`;
        case "map":
            return "Object"; // Maps don't have direct GraphQL equivalent
        case "literal":
            return "String";
        case "unknown":
            return "Object";
        default:
            return "String";
    }
}

/**
 * Extract the un-namespaced type name from a Fern type name.
 * e.g., "orders_UserInput" -> "UserInput"
 */
function unnamespacedName(name: string): string {
    const lastUnderscoreIndex = name.lastIndexOf("_");
    return lastUnderscoreIndex !== -1 ? name.slice(lastUnderscoreIndex + 1) : name;
}

/**
 * Convert a primitive type to GraphQL type
 */
function primitiveToGraphQlType(primitive: PrimitiveType): string {
    switch (primitive.type) {
        case "scalar":
            return primitive.name;
        case "integer":
        case "long":
        case "uint":
        case "uint64":
        case "bigInteger":
            return "Int";
        case "double":
            return "Float";
        case "boolean":
            return "Boolean";
        case "string":
        case "uuid":
        case "base64":
        case "datetime":
        case "date":
        default:
            return "String";
    }
}

/**
 * Collect all properties for an object type, including inherited properties from `extends`.
 */
function collectObjectProperties(
    shape: { extends: TypeId[]; properties: ObjectProperty[] },
    types: Record<TypeId, TypeDefinition>
): ObjectProperty[] {
    const properties: ObjectProperty[] = [];
    for (const parentId of shape.extends) {
        const parentDef = types[parentId];
        if (parentDef?.shape?.type === "object") {
            properties.push(...collectObjectProperties(parentDef.shape, types));
        }
    }
    properties.push(...shape.properties);
    return properties;
}

/**
 * Generate an example value for a type
 */
function generateExampleValue(
    shape: TypeShape,
    types: Record<TypeId, TypeDefinition>,
    depth: number,
    visited: Set<TypeId>,
    defaultValue?: unknown
): unknown {
    if (defaultValue !== undefined) {
        return defaultValue;
    }

    if (depth <= 0) {
        return null;
    }

    if (shape.type === "alias") {
        return generateExampleValueFromReference(shape.value, types, depth, visited);
    }
    if (shape.type === "enum") {
        // Return the first enum value if available
        const firstValue = shape.values?.[0];
        return firstValue?.value ?? "EXAMPLE_VALUE";
    }
    if (shape.type === "object") {
        const properties = collectObjectProperties(shape, types);
        if (properties.length === 0) {
            return {};
        }
        const result: Record<string, unknown> = {};
        for (const prop of properties.slice(0, 10)) {
            result[prop.key] = generateExampleValue(prop.valueShape, types, depth - 1, visited);
        }
        return result;
    }
    if (shape.type === "undiscriminatedUnion") {
        const firstVariant = shape.variants?.[0];
        if (firstVariant?.shape) {
            return generateExampleValue(firstVariant.shape, types, depth, visited);
        }
        return {};
    }
    if (shape.type === "discriminatedUnion") {
        const firstVariant = shape.variants?.[0];
        if (firstVariant) {
            const result: Record<string, unknown> = {
                [shape.discriminant]: firstVariant.discriminantValue
            };
            const properties = collectObjectProperties(firstVariant, types);
            for (const prop of properties.slice(0, 10)) {
                result[prop.key] = generateExampleValue(prop.valueShape, types, depth - 1, visited);
            }
            return result;
        }
        return {};
    }

    return "example";
}

/**
 * Generate an example value from a type reference
 */
function generateExampleValueFromReference(
    ref: TypeReference,
    types: Record<TypeId, TypeDefinition>,
    depth: number,
    visited: Set<TypeId>
): unknown {
    switch (ref.type) {
        case "primitive":
            return generateExamplePrimitiveValue(ref.value);
        case "id": {
            if (visited.has(ref.id)) {
                return null;
            }
            const typeDef = types[ref.id];
            if (typeDef?.shape) {
                visited.add(ref.id);
                const result = generateExampleValue(typeDef.shape, types, depth, visited);
                visited.delete(ref.id);
                return result;
            }
            return {};
        }
        case "optional":
        case "nullable":
            return generateExampleValue(ref.shape, types, depth, visited);
        case "list":
        case "set":
            return [generateExampleValue(ref.itemShape, types, depth, visited)];
        case "map":
            return {};
        case "literal":
            return ref.value.value;
        case "unknown":
            return {};
        default:
            return "example";
    }
}

/**
 * Generate example primitive values
 */
function generateExamplePrimitiveValue(primitive: PrimitiveType): unknown {
    switch (primitive.type) {
        case "integer":
        case "long":
        case "uint":
        case "uint64":
        case "bigInteger":
            return 0;
        case "double":
            return 0.0;
        case "boolean":
            return true;
        case "string":
            return "example";
        case "uuid":
            return "00000000-0000-0000-0000-000000000000";
        case "datetime":
            return new Date().toISOString();
        case "date":
            return new Date().toISOString().split("T")[0];
        case "base64":
            return "ZXhhbXBsZQ==";
        case "scalar":
            return primitive.default ?? primitive.name;
        default:
            return "example";
    }
}

/**
 * Generate a selection set for the return type
 */
function generateSelectionSet(
    shape: TypeShape,
    types: Record<TypeId, TypeDefinition>,
    depth: number,
    visited: Set<TypeId> = new Set(),
    indentLevel: number = 2
): string {
    if (depth <= 0) {
        return "";
    }

    if (shape.type === "alias") {
        return generateSelectionSetFromReference(shape.value, types, depth, visited, indentLevel);
    }

    if (shape.type === "object") {
        const properties = shape.properties ?? [];
        if (properties.length === 0) {
            return "";
        }

        const indent = "  ".repeat(indentLevel);
        const closingIndent = "  ".repeat(indentLevel - 1);

        const fields = properties
            .slice(0, 10) // Limit to first 10 fields
            .map((prop) => {
                const nestedSelection = generateSelectionSet(
                    prop.valueShape,
                    types,
                    depth - 1,
                    visited,
                    indentLevel + 1
                );
                if (nestedSelection) {
                    return `${indent}${prop.key} ${nestedSelection}`;
                }
                return `${indent}${prop.key}`;
            });

        return `{\n${fields.join("\n")}\n${closingIndent}}`;
    }

    if (shape.type === "enum") {
        return ""; // Enums don't have selection sets
    }

    if (shape.type === "undiscriminatedUnion" || shape.type === "discriminatedUnion") {
        // For unions, just return the field name without nested selection
        return "";
    }

    return "";
}

/**
 * Generate selection set from a type reference
 */
function generateSelectionSetFromReference(
    ref: TypeReference,
    types: Record<TypeId, TypeDefinition>,
    depth: number,
    visited: Set<TypeId>,
    indentLevel: number
): string {
    switch (ref.type) {
        case "id": {
            if (visited.has(ref.id)) {
                return ""; // Prevent infinite recursion
            }
            const typeDef = types[ref.id];
            if (typeDef?.shape) {
                visited.add(ref.id);
                const result = generateSelectionSet(typeDef.shape, types, depth, visited, indentLevel);
                visited.delete(ref.id);
                return result;
            }
            return "";
        }
        case "optional":
        case "nullable":
            return generateSelectionSet(ref.shape, types, depth, visited, indentLevel);
        case "list":
        case "set":
            return generateSelectionSet(ref.itemShape, types, depth, visited, indentLevel);
        case "primitive":
        case "literal":
        case "unknown":
        case "map":
        default:
            return "";
    }
}

/**
 * Generate a GraphQL response example
 */
function generateResponseExample(
    operationName: string,
    returnType: TypeShape,
    types: Record<TypeId, TypeDefinition>
): unknown {
    const data = generateResponseData(returnType, types, 3, new Set());
    return {
        data: {
            [operationName]: data
        }
    };
}

/**
 * Generate response data from a type shape
 */
function generateResponseData(
    shape: TypeShape,
    types: Record<TypeId, TypeDefinition>,
    depth: number,
    visited: Set<TypeId>
): unknown {
    if (depth <= 0) {
        return null;
    }

    if (shape.type === "alias") {
        return generateResponseDataFromReference(shape.value, types, depth, visited);
    }

    if (shape.type === "object") {
        const properties = shape.properties ?? [];
        if (properties.length === 0) {
            return {};
        }

        const result: Record<string, unknown> = {};
        for (const prop of properties.slice(0, 10)) {
            result[prop.key] = generateResponseData(prop.valueShape, types, depth - 1, visited);
        }
        return result;
    }

    if (shape.type === "enum") {
        const firstValue = shape.values?.[0];
        return firstValue?.value ?? "EXAMPLE_VALUE";
    }

    if (shape.type === "undiscriminatedUnion") {
        // Return example for the first variant
        const firstVariant = shape.variants?.[0];
        if (firstVariant?.shape) {
            return generateResponseData(firstVariant.shape, types, depth, visited);
        }
        return {};
    }

    if (shape.type === "discriminatedUnion") {
        // Return example for the first variant
        const firstVariant = shape.variants?.[0];
        if (firstVariant) {
            const result: Record<string, unknown> = {
                [shape.discriminant]: firstVariant.discriminantValue
            };
            if (firstVariant.properties) {
                for (const prop of firstVariant.properties.slice(0, 10)) {
                    result[prop.key] = generateResponseData(prop.valueShape, types, depth - 1, visited);
                }
            }
            return result;
        }
        return {};
    }

    return null;
}

/**
 * Generate response data from a type reference
 */
function generateResponseDataFromReference(
    ref: TypeReference,
    types: Record<TypeId, TypeDefinition>,
    depth: number,
    visited: Set<TypeId>
): unknown {
    switch (ref.type) {
        case "primitive":
            return generateExamplePrimitiveValue(ref.value);
        case "id": {
            if (visited.has(ref.id)) {
                return null; // Prevent infinite recursion
            }
            const typeDef = types[ref.id];
            if (typeDef?.shape) {
                visited.add(ref.id);
                const result = generateResponseData(typeDef.shape, types, depth, visited);
                visited.delete(ref.id);
                return result;
            }
            return {};
        }
        case "optional":
        case "nullable":
            return generateResponseData(ref.shape, types, depth, visited);
        case "list":
        case "set":
            return [generateResponseData(ref.itemShape, types, depth, visited)];
        case "map":
            return {};
        case "literal":
            return ref.value.value;
        case "unknown":
            return {};
        default:
            return null;
    }
}
