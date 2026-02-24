/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TargetId } from "httpsnippet-lite";
import type { DynamicIr } from "../../client/APIV1Write";
import type { HttpSnippetLanguage } from "../../orpc-client/shared.js";

/**
 * Map of language identifiers to their dynamic IR data
 */
export type DynamicIRsByLanguage = Record<string, DynamicIr>;

/**
 * Configuration for an HTTP snippet client
 */
export interface HTTPSnippetClient {
    targetId: TargetId;
    clientId: string;
}

/**
 * Flags controlling snippet generation behavior
 */
export interface SnippetGenerationFlags {
    /**
     * Controls HTTP snippet generation.
     * - `false`: Only generate curl snippets
     * - `true`: Generate HTTP snippets for all supported languages
     * - `HttpSnippetLanguage[]`: Generate HTTP snippets only for specified languages
     */
    httpSnippets: boolean | HttpSnippetLanguage[];

    /**
     * When true, always generate JavaScript fetch snippets even if TypeScript snippets exist
     */
    alwaysEnableJavaScriptFetch: boolean;
}

/**
 * Supported languages for SDK snippet generation
 */
export type SdkSnippetLanguage = "typescript" | "python" | "java" | "ruby" | "swift" | "csharp" | "go" | "php";

export const SDK_SNIPPET_LANGUAGES: SdkSnippetLanguage[] = [
    "typescript",
    "python",
    "java",
    "ruby",
    "swift",
    "csharp",
    "go",
    "php"
];

/**
 * Map of language identifiers to their snippet generators.
 * Uses `any` type because the actual generator type from @fern-api/snippets
 * has complex type requirements that we don't need to enforce here.
 */
export type SnippetGenerators = Record<string, any>;

export type { HttpSnippetLanguage };
