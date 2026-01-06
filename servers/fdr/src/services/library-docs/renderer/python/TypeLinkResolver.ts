/**
 * TypeLinkResolver - Generate links from resolved type paths.
 */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import { escapeMdx, generateAnchorId } from "../base/index.js";

/**
 * Generate a markdown link from TypeInfo.
 *
 * Uses display for text, basePath for anchor generation.
 *
 * @param typeInfo - TypeInfo with display, resolvedPath, and basePath
 * @param baseSlug - Base URL slug (e.g., "api-reference")
 * @returns Markdown link with display name and URL, or escaped type string if not linkable
 */
export function linkTypeInfo(typeInfo: FdrLambda.libraryDocs.TypeInfo | undefined, baseSlug: string): string {
    if (!typeInfo) {
        return "-";
    }

    const displayName = typeInfo.display ?? typeInfo.resolvedPath;
    const anchorPath = typeInfo.basePath;

    if (!displayName) {
        return "-";
    }

    // If we have a basePath, we can generate a proper link
    if (anchorPath) {
        const parts = anchorPath.split(".");
        if (parts.length >= 2) {
            // Build module slug from basePath (no brackets)
            const moduleSlug = parts.slice(0, -1).join("/");

            // Generate anchor from basePath (no brackets, so valid anchor)
            const anchor = generateAnchorId(anchorPath);

            return `[${escapeMdx(displayName)}](/${baseSlug}/${moduleSlug}#${anchor})`;
        }
    }

    // Fallback: just display the type without a link
    return `\`${escapeMdx(displayName)}\``;
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
