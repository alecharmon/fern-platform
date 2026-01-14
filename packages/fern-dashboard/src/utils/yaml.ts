/**
 * Shared YAML Utilities with Comment Preservation
 *
 * This module provides utilities for reading and writing YAML content
 * while preserving comments and formatting. Uses the `yaml` package (v2.x)
 * which supports YAML 1.2 and maintains comments in the AST.
 *
 * Use these utilities instead of js-yaml when you need to:
 * - Update values in existing YAML files (preserves comments)
 * - Stringify new YAML content with consistent formatting
 *
 * BEHAVIORAL DIFFERENCES FROM js-yaml:
 * - Date parsing: Bare dates like `date: 2024-01-15` are kept as strings ("2024-01-15"),
 *   whereas js-yaml converts them to Date objects. This is not a concern for Fern configs
 *   (docs.yml, generators.yml, OpenAPI specs) which use quoted string dates.
 * - Empty string quoting: Uses double quotes ("") instead of single quotes ('')
 * - YAML spec: Follows YAML 1.2 (js-yaml follows YAML 1.1), but for standard configs
 *   the differences (octal numbers, boolean keywords) are not relevant.
 */

import type { Document, DocumentOptions, ToStringOptions } from "yaml";
import { parseDocument, stringify } from "yaml";

export interface YamlUpdateResult {
    /** Whether the update was successful */
    success: boolean;
    /** The updated content (if successful) */
    content?: string;
    /** Error message (if failed) */
    error?: string;
}

export interface StringifyOptions extends ToStringOptions, DocumentOptions {
    /** Add schema comment at the top of the file */
    schemaUrl?: string;
}

/**
 * Detect if content is YAML or JSON based on content structure.
 * JSON always starts with { or [, everything else is treated as YAML.
 */
export function isYamlContent(content: string): boolean {
    const trimmed = content.trim();
    return !trimmed.startsWith("{") && !trimmed.startsWith("[");
}

/**
 * Parse YAML content and return both the JavaScript object and the Document.
 * The Document preserves comments and formatting for later modification.
 *
 * @param content - The YAML content string
 * @returns Object containing the parsed data and the Document for modification
 */
export function parseYaml(content: string): { data: unknown; doc: Document } {
    const doc = parseDocument(content);
    return {
        data: doc.toJS(),
        doc
    };
}

/**
 * Parse YAML content and return just the JavaScript object.
 * Use this when you only need to read values, not modify the content.
 *
 * @param content - The YAML or JSON content string
 * @returns The parsed JavaScript object
 */
export function parseYamlToJs<T = unknown>(content: string): T {
    if (!isYamlContent(content)) {
        return JSON.parse(content) as T;
    }
    const doc = parseDocument(content);
    return doc.toJS() as T;
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
        const data = parseYamlToJs<Record<string, unknown>>(content);
        if (!data || typeof data !== "object") {
            return undefined;
        }

        let current: unknown = data;
        for (const key of jsonPath) {
            if (current == null || typeof current !== "object") {
                return undefined;
            }
            if (Array.isArray(current)) {
                const idx = parseInt(key, 10);
                if (isNaN(idx)) {
                    return undefined;
                }
                current = current[idx];
            } else {
                current = (current as Record<string, unknown>)[key];
            }
        }

        return current;
    } catch {
        return undefined;
    }
}

/**
 * Update a value at a JSON path in YAML or JSON content.
 * Preserves comments and formatting in YAML files.
 * Creates intermediate objects if they don't exist.
 *
 * @param content - The YAML or JSON content string
 * @param jsonPath - Array of keys representing the path to the value
 * @param newValue - The new value to set
 * @param createIntermediates - Whether to create intermediate objects (default: true)
 * @returns Result object with success status and updated content or error
 */
export function updateYamlValue(
    content: string,
    jsonPath: string[],
    newValue: unknown,
    createIntermediates = true
): YamlUpdateResult {
    try {
        if (jsonPath.length === 0) {
            return {
                success: false,
                error: "Empty path provided"
            };
        }

        // Handle JSON content separately (no comments to preserve)
        if (!isYamlContent(content)) {
            return updateJsonValue(content, jsonPath, newValue, createIntermediates);
        }

        // Parse as YAML Document to preserve comments
        const doc = parseDocument(content);

        if (doc.errors.length > 0) {
            return {
                success: false,
                error: `Failed to parse YAML: ${doc.errors[0]?.message ?? "Unknown error"}`
            };
        }

        // Use setIn to set the value at the path
        // setIn creates intermediate nodes automatically when createIntermediates is true
        if (createIntermediates) {
            doc.setIn(jsonPath, newValue);
        } else {
            // Check if path exists first
            const existing = doc.getIn(jsonPath);
            if (existing === undefined) {
                return {
                    success: false,
                    error: `Path not found: ${jsonPath.join(".")}`
                };
            }
            doc.setIn(jsonPath, newValue);
        }

        // Serialize back to string, preserving comments
        const updatedContent = doc.toString({
            lineWidth: 0, // Don't wrap lines
            defaultKeyType: "PLAIN",
            defaultStringType: "PLAIN"
        });

        return {
            success: true,
            content: updatedContent
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error updating YAML content"
        };
    }
}

/**
 * Update a value in JSON content (internal helper).
 */
function updateJsonValue(
    content: string,
    jsonPath: string[],
    newValue: unknown,
    createIntermediates: boolean
): YamlUpdateResult {
    try {
        const doc = JSON.parse(content) as Record<string, unknown>;
        if (!doc || typeof doc !== "object") {
            return {
                success: false,
                error: "Failed to parse content as JSON"
            };
        }

        // Navigate to parent
        let current: Record<string, unknown> | unknown[] = doc;
        for (let i = 0; i < jsonPath.length - 1; i++) {
            const key = jsonPath[i];
            if (key === undefined) {
                return { success: false, error: `Invalid path at index ${i}` };
            }

            if (Array.isArray(current)) {
                const idx = parseInt(key, 10);
                if (isNaN(idx)) {
                    return { success: false, error: `Expected array index but got "${key}"` };
                }
                while (current.length <= idx) {
                    current.push({});
                }
                current = current[idx] as Record<string, unknown>;
            } else {
                const next = current[key];
                if (next === undefined || next === null) {
                    if (createIntermediates) {
                        current[key] = {};
                        current = current[key] as Record<string, unknown>;
                    } else {
                        return { success: false, error: `Path not found: ${jsonPath.slice(0, i + 1).join(".")}` };
                    }
                } else if (typeof next === "object") {
                    current = next as Record<string, unknown> | unknown[];
                } else if (createIntermediates) {
                    current[key] = {};
                    current = current[key] as Record<string, unknown>;
                } else {
                    return { success: false, error: `Path not found: ${jsonPath.slice(0, i + 1).join(".")}` };
                }
            }
        }

        // Set final value
        const finalKey = jsonPath[jsonPath.length - 1];
        if (finalKey === undefined) {
            return { success: false, error: "Empty path provided" };
        }

        if (Array.isArray(current)) {
            const idx = parseInt(finalKey, 10);
            if (isNaN(idx)) {
                return { success: false, error: `Expected array index but got "${finalKey}"` };
            }
            while (current.length <= idx) {
                current.push({});
            }
            current[idx] = newValue;
        } else {
            current[finalKey] = newValue;
        }

        return {
            success: true,
            content: JSON.stringify(doc, null, 2)
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error updating JSON content"
        };
    }
}

/**
 * Stringify a JavaScript object to YAML format.
 * Use this for creating new YAML files (no comments to preserve).
 *
 * @param data - The JavaScript object to stringify
 * @param options - Stringify options including optional schema URL
 * @returns YAML string
 */
export function stringifyYaml(data: unknown, options?: StringifyOptions): string {
    const { schemaUrl, ...yamlOptions } = options ?? {};

    const yamlContent = stringify(data, {
        lineWidth: 0, // Don't wrap lines
        defaultKeyType: "PLAIN",
        defaultStringType: "PLAIN",
        ...yamlOptions
    });

    if (schemaUrl) {
        return `# yaml-language-server: $schema=${schemaUrl}\n\n${yamlContent}`;
    }

    return yamlContent;
}

/**
 * Common schema URLs for Fern configuration files.
 */
export const YAML_SCHEMAS = {
    DOCS_YML: "https://schema.buildwithfern.dev/docs-yml.json",
    GENERATORS_YML: "https://schema.buildwithfern.dev/generators-yml.json"
} as const;
