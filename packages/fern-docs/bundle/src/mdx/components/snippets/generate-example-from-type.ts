import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

/**
 * Generates an example JSON value from a TypeDefinition.
 *
 * This is a hacky copy of the logic from fdr-sdk's generateHttpBodyExample.ts
 * adapted to work with the "read" API types (ApiDefinition.TypeShape).
 */

export type ResolveTypeById = (typeId: ApiDefinition.TypeId) => ApiDefinition.TypeDefinition | undefined;

export function generateExampleFromTypeDefinition(
    typeDefinition: ApiDefinition.TypeDefinition,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): unknown {
    const resolveTypeById: ResolveTypeById = (id) => types[id];
    return generateExampleFromTypeShape(typeDefinition.shape, resolveTypeById, false, new Set(), 0);
}

export function generateExampleFromTypeShape(
    shape: ApiDefinition.TypeShape,
    resolveTypeById: ResolveTypeById,
    ignoreOptionals: boolean,
    visited: Set<string>,
    depth: number
): unknown {
    switch (shape.type) {
        case "object":
            return generateExampleObject(shape, resolveTypeById, ignoreOptionals, visited, depth);
        case "undiscriminatedUnion":
            if (shape.variants[0] == null) {
                return {};
            }
            return generateExampleFromTypeShape(
                shape.variants[0].shape,
                resolveTypeById,
                ignoreOptionals,
                visited,
                depth
            );
        case "discriminatedUnion":
            if (shape.variants[0] == null) {
                return {};
            }
            return {
                [shape.discriminant]: shape.variants[0].discriminantValue,
                ...generateExampleObject(shape.variants[0], resolveTypeById, ignoreOptionals, visited, depth)
            };
        case "alias":
            return generateExampleFromTypeReference(shape.value, resolveTypeById, ignoreOptionals, visited, depth);
        case "enum":
            return shape.values[0]?.value ?? "";
    }
}

function generateExampleObject(
    object: ApiDefinition.ObjectType,
    resolveTypeById: ResolveTypeById,
    ignoreOptionals: boolean,
    visited: Set<string>,
    depth: number
): Record<string, unknown> {
    const example: Record<string, unknown> = {};
    for (const property of getAllObjectProperties(object, resolveTypeById)) {
        const value = generateExampleFromTypeShape(
            property.valueShape,
            resolveTypeById,
            ignoreOptionals,
            depth === 0 ? new Set() : new Set(visited),
            depth + 1
        );
        if (value != null) {
            example[property.key] = value;
        }
    }
    return example;
}

export function generateExampleFromTypeReference(
    reference: ApiDefinition.TypeReference,
    resolveTypeById: ResolveTypeById,
    ignoreOptionals: boolean,
    visited: Set<string>,
    depth: number
): unknown {
    let example;

    switch (reference.type) {
        case "primitive":
            example = generateExamplePrimitive(reference.value);
            break;
        case "id": {
            visited.add(reference.id);
            example = generateExampleFromId(reference.id, resolveTypeById, ignoreOptionals, visited, depth);
            break;
        }
        case "optional":
            if (reference.shape.type === "alias" && reference.shape.value.type === "id") {
                if (visited.has(reference.shape.value.id)) {
                    example = undefined;
                    break;
                } else {
                    visited.add(reference.shape.value.id);
                }
            }
            if (ignoreOptionals) {
                example = undefined;
            } else {
                example =
                    reference.default ??
                    generateExampleFromTypeShape(reference.shape, resolveTypeById, ignoreOptionals, visited, depth);
            }
            break;
        case "nullable":
            if (reference.shape.type === "alias" && reference.shape.value.type === "id") {
                if (visited.has(reference.shape.value.id)) {
                    example = undefined;
                    break;
                } else {
                    visited.add(reference.shape.value.id);
                }
            }
            example = generateExampleFromTypeShape(reference.shape, resolveTypeById, ignoreOptionals, visited, depth);
            break;
        case "list":
            if (reference.itemShape.type === "alias" && reference.itemShape.value.type === "id") {
                if (visited.has(reference.itemShape.value.id)) {
                    example = [];
                    break;
                } else {
                    visited.add(reference.itemShape.value.id);
                }
            }
            example = [
                generateExampleFromTypeShape(reference.itemShape, resolveTypeById, ignoreOptionals, visited, depth)
            ];
            break;
        case "set":
            example = [
                generateExampleFromTypeShape(reference.itemShape, resolveTypeById, ignoreOptionals, visited, depth)
            ];
            break;
        case "map":
            example = {
                [generateExampleFromTypeShape(
                    reference.keyShape,
                    resolveTypeById,
                    ignoreOptionals,
                    visited,
                    depth + 1
                ) as string]: generateExampleFromTypeShape(
                    reference.valueShape,
                    resolveTypeById,
                    ignoreOptionals,
                    visited,
                    depth + 1
                )
            };
            break;
        case "unknown":
            example = {};
            break;
        case "literal":
            example = generateExampleFromLiteral(reference.value);
            break;
        default:
            example = {};
    }

    return example;
}

function generateExampleFromId(
    id: ApiDefinition.TypeId,
    resolveTypeById: ResolveTypeById,
    ignoreOptionals: boolean,
    visited: Set<string>,
    depth: number
): unknown {
    const typeDef = resolveTypeById(id);
    if (typeDef == null) {
        return {};
    }
    return generateExampleFromTypeShape(typeDef.shape, resolveTypeById, ignoreOptionals, visited, depth);
}

export function generateExampleFromLiteral(literal: ApiDefinition.LiteralType): boolean | string {
    switch (literal.type) {
        case "booleanLiteral":
            return literal.value;
        case "stringLiteral":
            return literal.value;
    }
}

function generateExamplePrimitive(primitive: ApiDefinition.PrimitiveType): string | number | boolean | null {
    switch (primitive.type) {
        case "string":
            return "string";
        case "integer":
            return 0;
        case "uint":
            return 0;
        case "uint64":
            return 0;
        case "double":
            return 1.0;
        case "boolean":
            return true;
        case "long":
            return 99999;
        case "datetime":
            return "2023-01-01T00:00:00Z";
        case "uuid":
            return "d5e9c84f-c2b2-4bf4-b4b0-7ffd7a9ffc32";
        case "base64":
            return "SGVsbG8gV29ybGQ=";
        case "date":
            return "2023-01-01";
        case "bigInteger":
            return "123456789123456789";
        default:
            return "string";
    }
}

function getAllObjectProperties(
    object: ApiDefinition.ObjectType,
    resolveTypeById: ResolveTypeById
): ApiDefinition.ObjectProperty[] {
    return [
        ...object.properties,
        ...object.extends.flatMap((typeId) => {
            const type = resolveTypeById(typeId);
            if (type == null) {
                return [];
            }
            let resolvedType = type;
            if (resolvedType.shape.type === "alias" && resolvedType.shape.value.type === "id") {
                const aliasedType = resolveTypeById(resolvedType.shape.value.id);
                if (aliasedType != null) {
                    resolvedType = aliasedType;
                }
            }
            if (resolvedType.shape.type !== "object") {
                // Skip non-object types in extends (e.g., primitives or aliases to primitives)
                return [];
            }
            return getAllObjectProperties(resolvedType.shape, resolveTypeById);
        })
    ];
}
