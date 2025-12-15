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
