import type { TypeId } from "../navigation";
import { LARGE_LOOP_TOLERANCE } from "./const";
import type { TypeDefinition } from "./latest";
import type { TypeShapeOrReference } from "./types";
import { unwrapObjectType, unwrapReference } from "./unwrap";

interface CollectReferencedTypeIdsOptions {
    maxDepth?: number;
}

/**
 * Collects all TypeIds that are referenced (directly or transitively) from a given type shape.
 * This is useful for filtering down a large types map to only the types needed for rendering
 * a specific schema, significantly reducing payload size.
 *
 * @param type - The root type shape to start traversal from
 * @param types - The full map of all type definitions
 * @param options - Optional configuration (maxDepth defaults to 10)
 * @returns A Set of TypeIds that are referenced from the root type
 */
export function collectReferencedTypeIds(
    type: TypeShapeOrReference,
    types: Record<TypeId, TypeDefinition>,
    { maxDepth = 10 }: CollectReferencedTypeIdsOptions = {}
): Set<TypeId> {
    const referencedIds = new Set<TypeId>();

    const stack: {
        shape: TypeShapeOrReference;
        visitedTypeIds: Set<TypeId>;
        depth: number;
    }[] = [{ shape: type, visitedTypeIds: new Set(), depth: 0 }];

    let loop = 0;
    while (stack.length > 0) {
        if (loop++ > LARGE_LOOP_TOLERANCE) {
            console.error("Infinite loop detected when collecting referenced type IDs");
            break;
        }

        const { shape, visitedTypeIds: parentVisitedTypeIds, depth } = stack.pop()!;

        if (depth > maxDepth) {
            continue;
        }

        const unwrapped = unwrapReference(shape, types);

        // Check for circular references
        let circularReferenceDetected = false;
        for (const typeId of unwrapped.visitedTypeIds) {
            if (parentVisitedTypeIds.has(typeId)) {
                circularReferenceDetected = true;
                break;
            }
            referencedIds.add(typeId);
        }

        if (circularReferenceDetected) {
            continue;
        }

        const visitedTypeIds = new Set([...parentVisitedTypeIds, ...unwrapped.visitedTypeIds]);

        // Handle object types - need to traverse properties and extended types
        if (unwrapped.shape.type === "object") {
            const obj = unwrapObjectType(unwrapped.shape, types, parentVisitedTypeIds);

            // Add type IDs from object unwrapping (extended types)
            for (const typeId of obj.visitedTypeIds) {
                referencedIds.add(typeId);
                visitedTypeIds.add(typeId);
            }

            // Traverse each property's value shape
            for (const property of obj.properties) {
                stack.push({
                    shape: property.valueShape,
                    visitedTypeIds,
                    depth: depth + 1
                });
            }

            // Traverse extra properties if present
            if (obj.extraProperties) {
                stack.push({
                    shape: obj.extraProperties,
                    visitedTypeIds,
                    depth: depth + 1
                });
            }
        } else if (unwrapped.shape.type === "undiscriminatedUnion") {
            // Traverse each variant
            for (const variant of unwrapped.shape.variants) {
                stack.push({
                    shape: variant.shape,
                    visitedTypeIds,
                    depth: depth + 1
                });
            }
        } else if (unwrapped.shape.type === "discriminatedUnion") {
            // Traverse each variant (variants extend ObjectType)
            for (const variant of unwrapped.shape.variants) {
                stack.push({
                    shape: { ...variant, type: "object" },
                    visitedTypeIds,
                    depth: depth + 1
                });
            }
        } else if (unwrapped.shape.type === "list" || unwrapped.shape.type === "set") {
            // Traverse item shape
            stack.push({
                shape: unwrapped.shape.itemShape,
                visitedTypeIds,
                depth: depth + 1
            });
        } else if (unwrapped.shape.type === "map") {
            // Traverse both key and value shapes
            stack.push({
                shape: unwrapped.shape.keyShape,
                visitedTypeIds,
                depth: depth + 1
            });
            stack.push({
                shape: unwrapped.shape.valueShape,
                visitedTypeIds,
                depth: depth + 1
            });
        }
        // Primitives, enums, literals, and unknown types don't reference other types
    }

    return referencedIds;
}

/**
 * Filters a types map to only include types that are referenced from the given root type.
 * This is a convenience function that combines collectReferencedTypeIds with filtering.
 *
 * @param rootType - The root type shape to start traversal from
 * @param types - The full map of all type definitions
 * @param options - Optional configuration (maxDepth defaults to 10)
 * @returns A filtered types map containing only referenced types
 */
export function filterReferencedTypes(
    rootType: TypeShapeOrReference,
    types: Record<TypeId, TypeDefinition>,
    options?: CollectReferencedTypeIdsOptions
): Record<TypeId, TypeDefinition> {
    const referencedIds = collectReferencedTypeIds(rootType, types, options);

    return Object.fromEntries(Object.entries(types).filter(([id]) => referencedIds.has(id as TypeId))) as Record<
        TypeId,
        TypeDefinition
    >;
}
