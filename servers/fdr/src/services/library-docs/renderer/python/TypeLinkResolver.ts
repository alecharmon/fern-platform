/**
 * TypeLinkResolver - Generate links from resolved type paths.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { escapeMdx, generateAnchorId } from "../base/index.js";

/**
 * Get the URL for a type's anchor, if linkable.
 *
 * @param typeInfo - TypeInfo with basePath for anchor generation
 * @param baseSlug - Base URL slug (e.g., "api-reference")
 * @param currentModulePath - Current module path for same-page detection (e.g., "nemo_rl.algorithms.dpo")
 * @returns URL string like "base-slug-module-path#anchor", or null if not linkable
 */
export function getTypeAnchorUrl(
    typeInfo: FdrLambda.libraryDocs.TypeInfo | undefined,
    baseSlug: string,
    currentModulePath?: string
): string | null {
    if (!typeInfo?.basePath) {
        return null;
    }

    const parts = typeInfo.basePath.split(".");
    if (parts.length < 2) {
        return null; // Skip builtins like 'str', 'int'
    }

    // Generate anchor from basePath (remove dots)
    const anchor = generateAnchorId(typeInfo.basePath);

    // Get target module path (all parts except the last one which is the class/function name)
    const targetModulePath = parts.slice(0, -1).join(".");

    // If same page, just return anchor
    if (currentModulePath && targetModulePath === currentModulePath) {
        return `#${anchor}`;
    }

    // Build path format: /base-slug/module/path
    // e.g., "library-docs" + "nemo_rl.models.policy.interfaces" -> "/library-docs/nemo_rl/models/policy/interfaces"
    const modulePath = parts.slice(0, -1).join("/");

    return `/${baseSlug}/${modulePath}#${anchor}`;
}

/**
 * Generate a markdown link from TypeInfo.
 *
 * Uses display for text, basePath for anchor generation.
 *
 * @param typeInfo - TypeInfo with display, resolvedPath, and basePath
 * @param baseSlug - Base URL slug (e.g., "api-reference")
 * @param currentModulePath - Current module path for same-page detection
 * @returns Markdown link with display name and URL, or escaped type string if not linkable
 */
export function linkTypeInfo(
    typeInfo: FdrLambda.libraryDocs.TypeInfo | undefined,
    baseSlug: string,
    currentModulePath?: string
): string {
    if (!typeInfo) {
        return "-";
    }

    const displayName = typeInfo.display ?? typeInfo.resolvedPath;

    if (!displayName) {
        return "-";
    }

    const url = getTypeAnchorUrl(typeInfo, baseSlug, currentModulePath);
    if (url) {
        return `[${escapeMdx(displayName)}](${url})`;
    }

    // Fallback: just display the type without a link
    return `\`${escapeMdx(displayName)}\``;
}

/**
 * Build a links map for CodeBlock component from type infos.
 * Maps fully qualified type paths (as they appear in signatures) to anchor URLs.
 *
 * @param typeInfos - Array of TypeInfo objects to process
 * @param baseSlug - Base URL slug (e.g., "api-reference")
 * @param currentModulePath - Current module path for same-page detection
 * @returns Record mapping type paths to anchor URLs
 */
export function buildCodeBlockLinks(
    typeInfos: (FdrLambda.libraryDocs.TypeInfo | undefined)[],
    baseSlug: string,
    currentModulePath?: string
): Record<string, string> {
    const links: Record<string, string> = {};

    for (const typeInfo of typeInfos) {
        if (!typeInfo) {
            continue;
        }

        const url = getTypeAnchorUrl(typeInfo, baseSlug, currentModulePath);
        if (!url) {
            continue;
        }

        // Use resolvedPath as key (how type appears in fully qualified signatures)
        const key = typeInfo.resolvedPath ?? typeInfo.basePath;
        if (key) {
            links[key] = url;
        }
    }

    return links;
}

/**
 * Get display string from TypeInfo.
 *
 * @param typeInfo - TypeInfo object
 * @returns Display string or empty string if no type
 */
export function getTypeDisplay(typeInfo: FdrLambda.libraryDocs.TypeInfo | undefined): string {
    if (!typeInfo) {
        return "";
    }
    return typeInfo.display ?? typeInfo.resolvedPath ?? "";
}

/**
 * Render a code block with optional links for type references.
 * Uses the CodeBlock component when links are present.
 *
 * @param code - The code to render
 * @param links - Map of type paths to URLs
 * @returns MDX string with CodeBlock wrapper if links present
 */
export function renderCodeBlockWithLinks(code: string, links: Record<string, string>): string {
    const lines: string[] = [];

    if (Object.keys(links).length > 0) {
        const linksJson = JSON.stringify(links);
        lines.push(`<CodeBlock links={${linksJson}}>`);
        lines.push("");
    }

    lines.push("```python");
    lines.push(code);
    lines.push("```");

    if (Object.keys(links).length > 0) {
        lines.push("");
        lines.push("</CodeBlock>");
    }

    return lines.join("\n");
}
