import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";

/**
 * The location of a property in a request or response.
 * Used to filter properties by access type (e.g., read-only properties are only shown in responses).
 */
export type PropertyLocation = "request" | "response";

/**
 * Creates a unique ID for a type definition that includes the location context.
 * This allows pre-rendering different views of the same type for request vs response contexts.
 */
export function getTypeIdWithLocation(id: string, location: PropertyLocation) {
    return `${id}_location:${location}`;
}

/**
 * Filters object properties based on their access level (READ_ONLY/WRITE_ONLY)
 * relative to whether this is a request or response context.
 */
export function filterObjectPropertiesByAccess(
    properties: ApiDefinition.ObjectProperty[],
    location: PropertyLocation | undefined
): ApiDefinition.ObjectProperty[] {
    if (location === undefined) {
        return properties;
    }

    return properties.filter((property) => {
        if (location === "request") {
            return property.propertyAccess !== "READ_ONLY";
        } else if (location === "response") {
            return property.propertyAccess !== "WRITE_ONLY";
        }
        return true;
    });
}

/**
 * Filters out duplicate object properties by key, keeping only the first occurrence.
 */
export function filterDuplicateObjectProperties(
    properties: ApiDefinition.ObjectProperty[]
): ApiDefinition.ObjectProperty[] {
    return properties.reduce<ApiDefinition.ObjectProperty[]>((acc, property) => {
        if (!acc.some((p) => p.key === property.key)) {
            acc.push(property);
        }
        return acc;
    }, []);
}

/**
 * Filters object properties by an exclusion list and optionally excludes deprecated properties.
 */
export function filterObjectPropertiesByExclude(
    properties: ApiDefinition.ObjectProperty[],
    exclude: string[] | undefined,
    excludeDeprecated: boolean | undefined
): ApiDefinition.ObjectProperty[] {
    return properties.filter((property) => {
        if (exclude?.includes(property.key)) {
            return false;
        }
        if (excludeDeprecated && property.availability === "Deprecated") {
            return false;
        }
        return true;
    });
}

/**
 * Checks if a type shape contains an inline enum (less than 6 values).
 * Used to determine if enum values should be rendered inline above the description.
 */
export function hasInlineEnum(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): boolean {
    const unwrapped = ApiDefinition.unwrapReference(shape, types);
    return visitDiscriminatedUnion(unwrapped.shape)._visit<boolean>({
        object: () => false,
        enum: (value) => value.values.length < 6,
        undiscriminatedUnion: () => false,
        discriminatedUnion: () => false,
        list: (value) => hasInlineEnum(value.itemShape, types),
        set: (value) => hasInlineEnum(value.itemShape, types),
        map: (map) => hasInlineEnum(map.keyShape, types) || hasInlineEnum(map.valueShape, types),
        primitive: () => false,
        literal: () => true,
        unknown: () => false,
        _other: () => false
    });
}

/**
 * Checks if a type shape has internal type references that need to be rendered.
 */
export function hasInternalTypeReference(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): boolean {
    const unwrapped = ApiDefinition.unwrapReference(shape, types);
    return visitDiscriminatedUnion(unwrapped.shape)._visit<boolean>({
        object: () => true,
        enum: () => true,
        undiscriminatedUnion: () => true,
        discriminatedUnion: () => true,
        list: () => true,
        set: () => true,
        map: (map) => hasInternalTypeReference(map.keyShape, types) || hasInternalTypeReference(map.valueShape, types),
        primitive: () => false,
        literal: () => true,
        unknown: () => false,
        _other: () => false
    });
}

type IconInfo = {
    content: string;
    size: number;
};

/**
 * Gets icon information for a type reference (used for undiscriminated union variants).
 */
export function getIconInfoForTypeReference(
    typeRef: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): IconInfo | null {
    return visitDiscriminatedUnion(ApiDefinition.unwrapReference(typeRef, types).shape)._visit<IconInfo | null>({
        primitive: (primitive) =>
            visitDiscriminatedUnion(primitive.value, "type")._visit<IconInfo | null>({
                string: () => ({ content: "abc", size: 6 }),
                boolean: () => ({ content: "true", size: 6 }),
                integer: () => ({ content: "123", size: 6 }),
                uint: () => ({ content: "123", size: 6 }),
                uint64: () => ({ content: "123", size: 6 }),
                double: () => ({ content: "1.2", size: 6 }),
                long: () => ({ content: "123", size: 6 }),
                datetime: () => ({ content: "abc", size: 6 }),
                uuid: () => ({ content: "abc", size: 6 }),
                base64: () => ({ content: "abc", size: 6 }),
                date: () => ({ content: "abc", size: 6 }),
                bigInteger: () => ({ content: "123", size: 6 }),
                _other: () => null
            }),
        literal: () => ({ content: "!", size: 6 }),
        object: () => null,
        undiscriminatedUnion: () => null,
        discriminatedUnion: () => null,
        enum: () => null,
        list: (list) => getIconInfoForTypeReference(list.itemShape, types),
        set: (set) => getIconInfoForTypeReference(set.itemShape, types),
        map: () => ({ content: "{}", size: 9 }),
        unknown: () => ({ content: "{}", size: 6 }),
        _other: () => null
    });
}
