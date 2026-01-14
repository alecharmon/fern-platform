/**
 * OpenAPI $ref Resolution Utilities
 *
 * Handles resolution of $ref references in OpenAPI specs,
 * including external file references and cycle detection.
 */

import type { ParsedOpenApiSpec, ReferenceObject, SchemaObject } from "./types";
import { isReferenceObject } from "./types";

/* Parsed $ref structure */
export interface ParsedRef {
    /** External file path (empty string for local refs) */
    filePath: string;
    /** JSON pointer path segments (e.g., ["components", "schemas", "User"]) */
    jsonPath: string[];
}

/**
 * Parse a $ref string into file path and JSON pointer components.
 *
 * Examples:
 * - "#/components/schemas/User" → { filePath: "", jsonPath: ["components", "schemas", "User"] }
 * - "./models.yaml#/User" → { filePath: "./models.yaml", jsonPath: ["User"] }
 * - "https://example.com/spec.json#/components/schemas/Pet" → { filePath: "https://...", jsonPath: [...] }
 */
export function parseRef(ref: string): ParsedRef {
    const hashIndex = ref.indexOf("#");

    if (hashIndex === -1) {
        // No JSON pointer, entire ref is file path
        return { filePath: ref, jsonPath: [] };
    }

    const filePath = ref.slice(0, hashIndex);
    const pointer = ref.slice(hashIndex + 1);

    // Parse JSON pointer (RFC 6901)
    // "/components/schemas/User" → ["components", "schemas", "User"]
    const jsonPath =
        pointer === "" || pointer === "/"
            ? []
            : pointer
                  .split("/")
                  .slice(1) // Remove leading empty string from split
                  .map((segment) =>
                      // Unescape JSON pointer special characters
                      segment
                          .replace(/~1/g, "/")
                          .replace(/~0/g, "~")
                  );

    return { filePath, jsonPath };
}

/**
 * Resolve a JSON path to a value in a parsed spec.
 *
 * @param spec The parsed OpenAPI spec object
 * @param jsonPath Array of path segments
 * @returns The value at the path, or undefined if not found
 */
export function resolveJsonPath(spec: ParsedOpenApiSpec, jsonPath: string[]): unknown {
    let current: unknown = spec;

    for (const segment of jsonPath) {
        if (current === null || current === undefined) {
            return undefined;
        }

        if (typeof current !== "object") {
            return undefined;
        }

        current = (current as Record<string, unknown>)[segment];
    }

    return current;
}

/* Result of resolving a reference chain */
export interface ResolvedRef {
    /** The resolved value (non-ref) */
    value: unknown;
    /** The file path where the final value was found */
    filePath: string;
    /** The JSON path to the final value */
    jsonPath: string[];
}

/* Context for ref resolution across multiple files */
export interface RefResolutionContext {
    /** Map of file path to parsed spec */
    specs: Map<string, ParsedOpenApiSpec>;
    /** Current file being resolved from */
    currentFile: string;
    /** Set of refs already visited (for cycle detection) */
    visited: Set<string>;
}

/**
 * Resolve a $ref, following reference chains and handling external files.
 *
 * @param ref The $ref string to resolve
 * @param context Resolution context with specs and cycle detection
 * @returns Resolved ref info, or null if unresolvable (not found or cycle)
 */
export function resolveRef(ref: string, context: RefResolutionContext): ResolvedRef | null {
    const { filePath, jsonPath } = parseRef(ref);

    // Determine target file
    const targetFile = filePath === "" ? context.currentFile : resolveFilePath(filePath, context.currentFile);

    // Create canonical ref for cycle detection
    const canonicalRef = `${targetFile}#/${jsonPath.join("/")}`;

    if (context.visited.has(canonicalRef)) {
        // Cycle detected
        return null;
    }

    // Get the target spec
    const targetSpec = context.specs.get(targetFile);
    if (!targetSpec) {
        // External file not loaded
        return null;
    }

    // Add to visited set
    context.visited.add(canonicalRef);

    // Resolve the path in the target spec
    const value = resolveJsonPath(targetSpec, jsonPath);
    if (value === undefined) {
        return null;
    }

    // Check if the resolved value is itself a reference
    if (isReferenceObject(value)) {
        // Recursively resolve
        return resolveRef(value.$ref, {
            ...context,
            currentFile: targetFile
        });
    }

    return {
        value,
        filePath: targetFile,
        jsonPath
    };
}

/**
 * Resolve a relative file path from a base file.
 *
 * @param relativePath The relative path (e.g., "./models.yaml", "../common/types.yaml")
 * @param baseFile The base file path to resolve from
 * @returns Resolved absolute-ish path
 */
export function resolveFilePath(relativePath: string, baseFile: string): string {
    // Handle absolute URLs
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
        return relativePath;
    }

    // Handle absolute paths
    if (relativePath.startsWith("/")) {
        return relativePath;
    }

    // Resolve relative path
    const baseDir = baseFile.substring(0, baseFile.lastIndexOf("/") + 1);
    const combined = baseDir + relativePath;

    // Normalize path (resolve . and ..)
    return normalizePath(combined);
}

/* Normalize a path by resolving . and .. segments */
function normalizePath(path: string): string {
    const segments = path.split("/");
    const result: string[] = [];

    for (const segment of segments) {
        if (segment === "..") {
            result.pop();
        } else if (segment !== "." && segment !== "") {
            result.push(segment);
        }
    }

    // Preserve leading slash if present
    const prefix = path.startsWith("/") ? "/" : "";
    return prefix + result.join("/");
}

/**
 * Follow a property path through a schema, resolving $refs along the way.
 *
 * @param schema Starting schema
 * @param propertyPath Array of property names to traverse
 * @param context Resolution context
 * @returns Info about where the final property is located, or null if not found
 */
export function resolvePropertyPath(
    schema: SchemaObject | ReferenceObject,
    propertyPath: string[],
    context: RefResolutionContext
): { filePath: string; jsonPath: string[] } | null {
    if (propertyPath.length === 0) {
        // Already at target
        if (isReferenceObject(schema)) {
            const resolved = resolveRef(schema.$ref, context);
            return resolved ? { filePath: resolved.filePath, jsonPath: resolved.jsonPath } : null;
        }
        return { filePath: context.currentFile, jsonPath: [] };
    }

    // Resolve if this is a reference
    let currentSchema: SchemaObject;
    let currentFile = context.currentFile;
    let basePath: string[] = [];

    if (isReferenceObject(schema)) {
        const resolved = resolveRef(schema.$ref, context);
        if (!resolved || typeof resolved.value !== "object" || resolved.value === null) {
            return null;
        }
        currentSchema = resolved.value as SchemaObject;
        currentFile = resolved.filePath;
        basePath = resolved.jsonPath;
    } else {
        currentSchema = schema;
    }

    // Handle composition types (allOf, oneOf, anyOf) - mark as not directly editable
    if (currentSchema.allOf || currentSchema.oneOf || currentSchema.anyOf) {
        // For composition types, we can't easily determine where the property is defined
        // Return null to mark as preview-only
        return null;
    }

    // FDR abstracts away array wrappers, so we traverse into items to find properties
    if (currentSchema.type === "array" && currentSchema.items) {
        const itemsSchema = currentSchema.items;
        // Recurse into items (will handle $ref if needed)
        const result = resolvePropertyPath(itemsSchema, propertyPath, {
            ...context,
            currentFile,
            visited: new Set(context.visited)
        });
        if (result) {
            // For inline items, prepend "items" to the path
            // For $ref items, the result already has the correct path in the referenced schema
            if (isReferenceObject(itemsSchema)) {
                // items is a $ref - the result path is relative to the referenced schema
                // Just return as-is (the property lives in the referenced type)
                return result;
            } else {
                // items is inline - prepend "items" to the path
                return {
                    filePath: result.filePath,
                    jsonPath: [...basePath, "items", ...result.jsonPath]
                };
            }
        }
        return null;
    }

    const [nextProp, ...remainingPath] = propertyPath;

    // Look for the property - nextProp is guaranteed to exist since propertyPath.length > 0
    if (!nextProp || !currentSchema.properties || !(nextProp in currentSchema.properties)) {
        // Property not in properties - try additionalProperties for map types
        // additionalProperties can be boolean (true/false) or a schema
        // Only traverse if it's a schema (object or $ref), not a boolean
        if (currentSchema.additionalProperties && typeof currentSchema.additionalProperties !== "boolean") {
            const additionalPropsSchema = currentSchema.additionalProperties;
            // Recurse into additionalProperties with the full propertyPath
            // since we're entering the value schema of the map
            const result = resolvePropertyPath(additionalPropsSchema, propertyPath, {
                ...context,
                currentFile,
                visited: new Set(context.visited)
            });
            if (result) {
                // For $ref additionalProperties, return as-is (property lives in referenced schema)
                // For inline additionalProperties, prepend "additionalProperties" to the path
                if (isReferenceObject(additionalPropsSchema)) {
                    return result;
                } else {
                    return {
                        filePath: result.filePath,
                        jsonPath: [...basePath, "additionalProperties", ...result.jsonPath]
                    };
                }
            }
        }
        // Property not found in properties or additionalProperties - mark as not editable
        return null;
    }

    const propSchema = currentSchema.properties[nextProp];

    // Property value might be undefined in loose type definitions
    if (!propSchema) {
        return null;
    }

    if (remainingPath.length === 0) {
        // This is the target property
        if (isReferenceObject(propSchema)) {
            // Property is a $ref - resolve to get actual location
            const resolved = resolveRef(propSchema.$ref, { ...context, currentFile });
            return resolved ? { filePath: resolved.filePath, jsonPath: resolved.jsonPath } : null;
        }
        // Property is inline
        return {
            filePath: currentFile,
            jsonPath: [...basePath, "properties", nextProp] as string[]
        };
    }

    // Need to go deeper - recurse into the property schema
    const nestedResult = resolvePropertyPath(propSchema, remainingPath, {
        ...context,
        currentFile,
        visited: new Set(context.visited)
    });

    if (!nestedResult) {
        return null;
    }

    // Prepend the current property's path to the nested result
    // If the nested property is a $ref that resolved to a different file/location,
    // use that location directly (the nested result already has the full path)
    // Otherwise, prepend the current property path
    if (isReferenceObject(propSchema)) {
        // Property itself is a $ref - the nested result has the full path from the referenced schema
        return nestedResult;
    } else {
        // Property is inline - prepend the path to this property
        return {
            filePath: nestedResult.filePath,
            jsonPath: [...basePath, "properties", nextProp, ...nestedResult.jsonPath]
        };
    }
}

/**
 * Check if a schema uses composition (allOf, oneOf, anyOf).
 * These are complex to edit and should be marked as preview-only.
 */
export function isCompositionSchema(schema: SchemaObject | ReferenceObject): boolean {
    if (isReferenceObject(schema)) {
        return false; // Need to resolve first to check
    }
    return !!(schema.allOf || schema.oneOf || schema.anyOf);
}
