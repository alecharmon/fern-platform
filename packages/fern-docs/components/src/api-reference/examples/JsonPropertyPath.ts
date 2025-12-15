export type JsonPropertyPath = readonly JsonPropertyPathPart[];

export type JsonPropertyPathPart =
    | JsonPropertyPathPart.ObjectProperty
    | JsonPropertyPathPart.ObjectFilter
    | JsonPropertyPathPart.ListItem;

export declare namespace JsonPropertyPathPart {
    export interface ObjectProperty {
        type: "objectProperty";
        // if absent, any property is matched
        propertyName?: string;
    }

    /**
     * TODO: support more than just string values (e.g. other primitives)
     */
    export interface ObjectFilter {
        type: "objectFilter";
        propertyName: string;
        requiredStringValue: string;
    }

    export interface ListItem {
        type: "listItem";
        // if absent, any item is matched
        index?: number;
    }
}

/**
 * Converts a JsonPropertyPath to a human-readable dot-separated string.
 *
 * @example
 * // Object properties: "parent.child.grandchild"
 * jsonPropertyPathToString([
 *   { type: "objectProperty", propertyName: "parent" },
 *   { type: "objectProperty", propertyName: "child" },
 *   { type: "objectProperty", propertyName: "grandchild" }
 * ]) // => "parent.child.grandchild"
 *
 * @example
 * // List items: "items[*]" or "items[0]"
 * jsonPropertyPathToString([
 *   { type: "objectProperty", propertyName: "items" },
 *   { type: "listItem", index: 0 }
 * ]) // => "items[0]"
 *
 * @example
 * // Wildcard properties: "data.*"
 * jsonPropertyPathToString([
 *   { type: "objectProperty", propertyName: "data" },
 *   { type: "objectProperty" }
 * ]) // => "data.*"
 */
export function jsonPropertyPathToString(path: JsonPropertyPath): string {
    let result = "";

    for (const part of path) {
        if (part.type === "objectProperty") {
            const segment = part.propertyName ?? "*";
            result = result ? `${result}.${segment}` : segment;
        } else if (part.type === "listItem") {
            result += `[${part.index ?? "*"}]`;
        } else if (part.type === "objectFilter") {
            result = result ? `${result}.${part.propertyName}` : part.propertyName;
        }
    }

    return result;
}
