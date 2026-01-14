/**
 * YAML/JSON Update Utilities
 *
 * Provides functions to update values in YAML or JSON content.
 * Note: YAML output uses js-yaml's default formatting.
 */

import yaml from "js-yaml";

export interface YamlUpdateResult {
    /** Whether the update was successful */
    success: boolean;
    /** The updated content (if successful) */
    content?: string;
    /** Error message (if failed) */
    error?: string;
}

/**
 * Detect if content is YAML or JSON based on file extension or content.
 */
function isYaml(content: string): boolean {
    const trimmed = content.trim();
    // JSON always starts with { or [
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return false;
    }
    return true;
}

/**
 * Update a value at a JSON path in YAML or JSON content.
 * Creates intermediate objects if they don't exist (always objects, never arrays).
 */
export function updateYamlValue(
    content: string,
    jsonPath: string[],
    newValue: string,
    createIntermediates = true
): YamlUpdateResult {
    try {
        const isYamlFormat = isYaml(content);

        // Parse the content
        const doc = yaml.load(content) as Record<string, unknown>;
        if (!doc || typeof doc !== "object") {
            return {
                success: false,
                error: "Failed to parse content as YAML/JSON"
            };
        }

        // Navigate to the parent of the target path, creating intermediate objects if needed
        let current: Record<string, unknown> | unknown[] = doc;
        for (let i = 0; i < jsonPath.length - 1; i++) {
            const key = jsonPath[i];
            if (key === undefined) {
                return {
                    success: false,
                    error: `Invalid path at index ${i}`
                };
            }

            // If current is an array, treat numeric keys as indices
            if (Array.isArray(current)) {
                const idx = parseInt(key, 10);
                if (isNaN(idx)) {
                    return {
                        success: false,
                        error: `Expected array index but got "${key}" at path index ${i}`
                    };
                }
                // Extend array if needed
                while (current.length <= idx) {
                    current.push({});
                }
                current = current[idx] as Record<string, unknown>;
                continue;
            }

            // Current is an object - check what exists at this key
            const next = current[key];
            if (next === undefined || next === null) {
                if (createIntermediates) {
                    // Always create objects when building new structure
                    // This is the safest approach for OpenAPI overrides
                    current[key] = {};
                    current = current[key] as Record<string, unknown>;
                } else {
                    return {
                        success: false,
                        error: `Path not found: ${jsonPath.slice(0, i + 1).join(".")}`
                    };
                }
            } else if (typeof next === "object") {
                // Navigate into existing structure (could be array or object)
                current = next as Record<string, unknown> | unknown[];
            } else {
                // Can't navigate into a primitive value
                if (createIntermediates) {
                    current[key] = {};
                    current = current[key] as Record<string, unknown>;
                } else {
                    return {
                        success: false,
                        error: `Path not found: ${jsonPath.slice(0, i + 1).join(".")}`
                    };
                }
            }
        }

        // Set the value at the final key
        const finalKey = jsonPath[jsonPath.length - 1];
        if (finalKey === undefined) {
            return {
                success: false,
                error: "Empty path provided"
            };
        }

        if (Array.isArray(current)) {
            const idx = parseInt(finalKey, 10);
            if (isNaN(idx)) {
                return {
                    success: false,
                    error: `Expected array index but got "${finalKey}" for final key`
                };
            }
            // Extend array if needed
            while (current.length <= idx) {
                current.push({});
            }
            current[idx] = newValue;
        } else {
            current[finalKey] = newValue;
        }

        // Serialize back to the original format
        let updatedContent: string;
        if (isYamlFormat) {
            updatedContent = yaml.dump(doc, {
                lineWidth: -1, // Don't wrap lines
                noRefs: true, // Don't use YAML references
                quotingType: '"', // Use double quotes for strings
                forceQuotes: false // Only quote when necessary
            });
        } else {
            updatedContent = JSON.stringify(doc, null, 2);
        }

        return {
            success: true,
            content: updatedContent
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error updating content"
        };
    }
}

/**
 * Get a value at a JSON path in YAML or JSON content.
 *
 * @param content - The YAML or JSON content string
 * @param jsonPath - Array of keys representing the path to the value
 * @returns The value at the path, or undefined if not found
 */
export function getYamlValue(content: string, jsonPath: string[]): unknown {
    try {
        const doc = yaml.load(content) as Record<string, unknown>;
        if (!doc || typeof doc !== "object") {
            return undefined;
        }

        let current: unknown = doc;
        for (const key of jsonPath) {
            if (!current || typeof current !== "object") {
                return undefined;
            }
            current = (current as Record<string, unknown>)[key];
        }

        return current;
    } catch {
        return undefined;
    }
}

/** Format type for override file content. */
export type OverrideFormat = "yaml" | "json";

/**
 * Create minimal YAML/JSON content for an override file with a single path.
 * Always creates objects (never arrays) for safe OpenAPI override merging.
 *
 * @param jsonPath - Array of keys representing the path to the value
 * @param value - The value to set at the path
 * @param format - Output format: "yaml" (default) or "json"
 */
export function createOverrideContent(jsonPath: string[], value: string, format: OverrideFormat = "yaml"): string {
    if (jsonPath.length === 0) {
        if (format === "json") {
            return JSON.stringify(value, null, 2);
        }
        return yaml.dump(value, { lineWidth: -1 });
    }

    // Build the nested object structure (always objects, never arrays)
    const obj: Record<string, unknown> = {};
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < jsonPath.length - 1; i++) {
        const key = jsonPath[i];
        if (key === undefined) {
            continue;
        }

        current[key] = {};
        current = current[key] as Record<string, unknown>;
    }

    // Set the final value
    const finalKey = jsonPath[jsonPath.length - 1];
    if (finalKey !== undefined) {
        current[finalKey] = value;
    }

    if (format === "json") {
        return JSON.stringify(obj, null, 2);
    }
    return yaml.dump(obj, {
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false
    });
}

/**
 * Create override content for a parameter description.
 * Parameters need name and in fields for proper merge matching.
 *
 * @param jsonPath - Array of keys representing the path (e.g., ["paths", "/plant", "get", "parameters", "0", "description"])
 * @param description - The description value
 * @param paramDetails - The parameter's name and in fields for identification
 * @param format - Output format: "yaml" (default) or "json"
 * @returns YAML/JSON string with the nested structure including full parameter object
 */
export function createParameterOverrideContent(
    jsonPath: string[],
    description: string,
    paramDetails: { name: string; in: string },
    format: OverrideFormat = "yaml"
): string {
    if (jsonPath.length === 0) {
        if (format === "json") {
            return JSON.stringify(description, null, 2);
        }
        return yaml.dump(description, { lineWidth: -1 });
    }

    // Build nested structure up to the parameters array
    // jsonPath is like: ["paths", "/plant", "get", "parameters", "0", "description"]
    // We want to build: paths -> /plant -> get -> parameters (array)
    const obj: Record<string, unknown> = {};
    let current: Record<string, unknown> = obj;

    // Navigate to just before "parameters" (stop at the operation level)
    // Find where "parameters" is in the path
    const parametersIndex = jsonPath.indexOf("parameters");
    if (parametersIndex === -1) {
        // Fallback to regular createOverrideContent if this isn't a parameter path
        return createOverrideContent(jsonPath, description, format);
    }

    // Build structure up to the operation level (before "parameters")
    for (let i = 0; i < parametersIndex; i++) {
        const key = jsonPath[i];
        if (key === undefined) {
            continue;
        }
        current[key] = {};
        current = current[key] as Record<string, unknown>;
    }

    // Create the parameters array with a full parameter object
    current["parameters"] = [
        {
            name: paramDetails.name,
            in: paramDetails.in,
            description: description
        }
    ];

    if (format === "json") {
        return JSON.stringify(obj, null, 2);
    }
    return yaml.dump(obj, {
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false
    });
}
