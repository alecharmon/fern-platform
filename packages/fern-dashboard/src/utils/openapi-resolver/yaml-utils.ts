/**
 * OpenAPI-specific YAML/JSON Utilities
 *
 * Provides functions for working with OpenAPI specs and override files.
 * Uses the shared yaml utility for comment-preserving updates.
 */

import {
    getYamlValue as sharedGetYamlValue,
    updateYamlValue as sharedUpdateYamlValue,
    stringifyYaml,
    type YamlUpdateResult
} from "@/utils/yaml";

// Re-export types and functions from shared utility
export type { YamlUpdateResult };
export { sharedGetYamlValue as getYamlValue, sharedUpdateYamlValue as updateYamlValue };

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
        return stringifyYaml(value);
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
    return stringifyYaml(obj);
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
        return stringifyYaml(description);
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
    return stringifyYaml(obj);
}
