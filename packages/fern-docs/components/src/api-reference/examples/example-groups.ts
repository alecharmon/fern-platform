import type { ApiDefinition } from "@fern-api/fdr-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { sortBy } from "es-toolkit/array";
import { isEqual } from "es-toolkit/predicate";
import type {
    ExamplesByKeyAndStatusCode,
    ExamplesByLanguageKeyAndStatusCode,
    ExamplesByStatusCode,
    SelectedExampleKey
} from "../type-definitions/EndpointContent";
import { type CodeExample, isUserDefinedExample } from "./code-example";

function hasNonEmptyValue(value: unknown): boolean {
    if (value == null) {
        return false;
    }
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        return Object.keys(value).length > 0;
    }
    if (typeof value === "string") {
        return value.length > 0;
    }
    return true;
}

function isMeaningfulParamValue(key: string, value: unknown): boolean {
    if (value == null) {
        return false;
    }
    if (typeof value === "string") {
        if (value.length === 0) {
            return false;
        }
        if (value === `:${key}`) {
            return false;
        }
    }
    return true;
}

function hasMeaningfulParams(params: Record<string, unknown> | undefined): boolean {
    if (params == null) {
        return false;
    }
    return Object.entries(params).some(([key, value]) => isMeaningfulParamValue(key, value));
}

/**
 * Check if an example key/name starts with "Default" (case-insensitive, trimmed)
 */
export function startsWithDefault(name: string | null | undefined): boolean {
    if (name == null) {
        return false;
    }
    return name.trim().toLowerCase().startsWith("default");
}

/**
 * Compare function for sorting examples by request data.
 * Examples with request data come first, those without come last.
 * Exception: if the name starts with "Default" (case-insensitive, trimmed), preserve original order.
 *
 * @param aHasRequestData - Whether item A has request data
 * @param bHasRequestData - Whether item B has request data
 * @param aName - The name of item A (for the Default check)
 * @param bName - The name of item B (for the Default check)
 * @returns -1 if A should come first, 1 if B should come first, 0 if order should be preserved
 */
export function compareByRequestData(
    aHasRequestData: boolean,
    bHasRequestData: boolean,
    aName: string | null | undefined,
    bName: string | null | undefined
): number {
    if (aHasRequestData && !bHasRequestData) {
        // Don't sort to bottom if name starts with "Default"
        if (startsWithDefault(bName)) {
            return 0;
        }
        return -1;
    }
    if (!aHasRequestData && bHasRequestData) {
        // Don't sort to bottom if name starts with "Default"
        if (startsWithDefault(aName)) {
            return 0;
        }
        return 1;
    }
    return 0;
}

/**
 * Check if an example has meaningful request-side data (body, path params, or query params).
 */
export function hasRequestSideData(exampleCall: ApiDefinition.ExampleEndpointCall): boolean {
    if (exampleCall.requestBody != null && hasNonEmptyValue(exampleCall.requestBody.value)) {
        return true;
    }
    if (hasMeaningfulParams(exampleCall.pathParameters)) {
        return true;
    }
    if (hasMeaningfulParams(exampleCall.queryParameters)) {
        return true;
    }
    return false;
}

/**
 * Check if an exampleKey has valid examples (non-empty, with success response or named).
 * This is a baseline check shared by both bundle and dashboard.
 */
export function hasValidExamples(examplesByStatusCode: ExamplesByStatusCode): boolean {
    const examples = Object.values(examplesByStatusCode).flat();
    if (examples.length === 0) {
        return false;
    }
    // Sort by status code to match original behavior for examples[0]?.name check
    const sortedExamples = sortBy(examples, [(ex) => ex.exampleCall.responseStatusCode]);
    return sortedExamples.some((ex) => ex.exampleCall.responseStatusCode < 400) || sortedExamples[0]?.name != null;
}

/**
 * Check if an exampleKey should be visible in the tabs (bundle version).
 * An exampleKey is visible if it has valid examples AND (meaningful request-side data OR is user-defined).
 * User-defined examples (with explicit names) are always shown, even without request-side data,
 * to support use cases like "Default - No Filtering" examples.
 */
export function isVisibleExampleKey(examplesByStatusCode: ExamplesByStatusCode): boolean {
    if (!hasValidExamples(examplesByStatusCode)) {
        return false;
    }
    const examples = Object.values(examplesByStatusCode).flat();
    return examples.some((ex) => hasRequestSideData(ex.exampleCall) || isUserDefinedExample(ex));
}

/**
 * Get the first visible exampleKey for a language.
 * Prioritizes examples with request-side data over those without.
 * Falls back to the first available exampleKey if none are visible.
 */
function getFirstVisibleExampleKey(examplesByKeyAndStatusCode: ExamplesByKeyAndStatusCode): string | undefined {
    const visibleKeys: { key: string; hasRequestData: boolean }[] = [];

    for (const [exampleKey, examplesByStatusCode] of Object.entries(examplesByKeyAndStatusCode)) {
        if (isVisibleExampleKey(examplesByStatusCode)) {
            const examples = Object.values(examplesByStatusCode).flat();
            const hasRequestData = examples.some((ex) => hasRequestSideData(ex.exampleCall));
            visibleKeys.push({ key: exampleKey, hasRequestData });
        }
    }

    if (visibleKeys.length === 0) {
        // Fallback to first available if none are visible
        return Object.keys(examplesByKeyAndStatusCode)[0];
    }

    // Sort so examples with request data come first
    // Exception: if the name starts with "Default" (case-insensitive, trimmed), preserve original order
    visibleKeys.sort((a, b) => compareByRequestData(a.hasRequestData, b.hasRequestData, a.key, b.key));

    return visibleKeys[0]?.key;
}

/**
 * Get a valid exampleKey for a language, preferring the current key if it exists.
 */
export function getValidExampleKey(
    examplesByKeyAndStatusCode: ExamplesByKeyAndStatusCode,
    currentKey: string | undefined
): string | undefined {
    const availableKeys = Object.keys(examplesByKeyAndStatusCode);
    if (availableKeys.includes(currentKey ?? "")) {
        return currentKey;
    }
    return getFirstVisibleExampleKey(examplesByKeyAndStatusCode);
}

/**
 * Group examples by language, title, and status code.
 *
 * @param endpoint - The endpoint to group examples for.
 * @returns An object where the keys are the language, exampleId, and statusCode, and the value is an array of code examples.
 */
export function groupExamplesByLanguageKeyAndStatusCode(
    endpoint: ApiDefinition.EndpointDefinition
): ExamplesByLanguageKeyAndStatusCode {
    const toRet: ExamplesByLanguageKeyAndStatusCode = {};

    function addCodeExample(
        key: { language: string; exampleKey: string; statusCode: number },
        codeExample: CodeExample
    ): void {
        const existing = (((toRet[key.language] ??= {})[key.exampleKey] ??= {})[key.statusCode] ??= []);
        if (existing.some((e) => isEqual(e.exampleCall.responseBody, codeExample.exampleCall.responseBody))) {
            return;
        }
        existing.push(codeExample);
    }

    endpoint.examples?.forEach((example, i) => {
        if (example.snippets == null) {
            return;
        }

        Object.entries(example.snippets).forEach(([language, snippets]) => {
            snippets.forEach((snippet, j) => {
                const statusCode = example.responseStatusCode;

                const exampleKey = example.name || `Example ${i + 1}`;

                const codeExample: CodeExample = {
                    key: `${language}-${i},${j}`,
                    exampleIndex: i,
                    snippetIndex: j,
                    exampleKey,
                    language,
                    name: snippet.name ?? example.name,
                    code: snippet.code,
                    install: snippet.install,
                    exampleCall: example
                };
                addCodeExample({ language, exampleKey, statusCode }, codeExample);

                endpoint.errors?.forEach((error, k) => {
                    error.examples?.forEach((errorExample, l) => {
                        const codeExample: CodeExample = {
                            key: `${language}-${i},${j},${k},${l}`,
                            exampleIndex: i,
                            snippetIndex: j,
                            exampleKey,
                            language,
                            name: snippet.name ?? example.name,
                            code: snippet.code,
                            install: snippet.install,
                            // HACK: this is a bit of a hack to append the global error to every example
                            exampleCall: {
                                ...example,
                                responseStatusCode: error.statusCode,
                                responseBody: errorExample.responseBody,
                                name: errorExample.name ?? error.name
                            },
                            globalError: true
                        };
                        addCodeExample(
                            {
                                language,
                                exampleKey,
                                statusCode: error.statusCode
                            },
                            codeExample
                        );
                    });
                });
            });
        });
    });

    return toRet;
}

/**
 * Get the available languages for a given endpoint.
 *
 * @param examples - The examples to get the available languages for.
 * @param defaultLanguage - The default language to promote to the top of the list.
 * @returns The available languages for the given endpoint in the order they should be displayed.
 */
export function getAvailableLanguages(examples: ExamplesByLanguageKeyAndStatusCode, defaultLanguage: string): string[] {
    return sortBy(
        Object.keys(examples).map((l) => ({ language: l })),
        [
            // promote the default language to the top of the list, otherwise promote curl
            (l) => (examples[defaultLanguage] != null ? l.language !== defaultLanguage : l.language !== "curl"),
            // sort the rest alphabetically
            (l) => l.language
        ]
    ).map((l) => l.language);
}

/**
 * Get the available languages for each status code.
 *
 * @param examples - The examples to get the available languages for.
 * @param defaultLanguage - The default language to promote to the top of the list.
 * @returns A dictionary mapping each status code to the available languages for that status code, in the order they should be displayed.
 */
export function getAvailableLanguagesByStatusCode(
    examples: ExamplesByLanguageKeyAndStatusCode,
    defaultLanguage: string
): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    // Collect all unique status codes
    const allStatusCodes = new Set<string>();
    Object.values(examples).forEach((examplesByKeyAndStatusCode) => {
        Object.values(examplesByKeyAndStatusCode).forEach((examplesByStatusCode) => {
            Object.keys(examplesByStatusCode).forEach((statusCode) => {
                allStatusCodes.add(statusCode);
            });
        });
    });

    // For each status code, find which languages have examples for it
    allStatusCodes.forEach((statusCode) => {
        const languagesWithStatusCode = Object.keys(examples).filter((language) => {
            const examplesByKeyAndStatusCode = examples[language];
            if (examplesByKeyAndStatusCode == null) {
                return false;
            }
            // Check if any example key has the requested status code
            return Object.values(examplesByKeyAndStatusCode).some((examplesByStatusCode) => {
                return examplesByStatusCode[statusCode] != null && examplesByStatusCode[statusCode].length > 0;
            });
        });

        // Sort the filtered languages
        result[statusCode] = sortBy(
            languagesWithStatusCode.map((l) => ({ language: l })),
            [
                // promote the default language to the top of the list, otherwise promote curl
                (l) => (examples[defaultLanguage] != null ? l.language !== defaultLanguage : l.language !== "curl"),
                // sort the rest alphabetically
                (l) => l.language
            ]
        ).map((l) => l.language);
    });

    return result;
}

interface SelectExampleToRenderResponse {
    selectedExampleKey: SelectedExampleKey;
    selectedExample: CodeExample | undefined;
    examplesByStatusCode: ExamplesByStatusCode;
    examplesByKeyAndStatusCode: ExamplesByKeyAndStatusCode;
}

/**
 * Select the example to render for a given key.
 *
 * @param examplesByLanguageKeyAndStatusCode - The examples to select the example to render for.
 * @param key - The key to select the example to render for.
 * @param defaultLanguage - The default language to use if the selected language is not found.
 * @returns The selected example to render + additional metadata about the selected example.
 */
export function selectExampleToRender(
    examplesByLanguageKeyAndStatusCode: ExamplesByLanguageKeyAndStatusCode,
    key: SelectedExampleKey,
    defaultLanguage: string
): SelectExampleToRenderResponse {
    const { language, exampleKey, statusCode, responseIndex } = key;

    // prefer the selected language, otherwise pick the first available language
    const examplesByKeyAndStatusCode =
        examplesByLanguageKeyAndStatusCode[language] ??
        examplesByLanguageKeyAndStatusCode[
            getAvailableLanguages(examplesByLanguageKeyAndStatusCode, defaultLanguage)[0] ?? ""
        ] ??
        {};

    // prefer the selected exampleId, otherwise pick the first VISIBLE exampleId
    const examplesByStatusCode =
        examplesByKeyAndStatusCode[exampleKey ?? ""] ??
        examplesByKeyAndStatusCode[getFirstVisibleExampleKey(examplesByKeyAndStatusCode) ?? ""] ??
        {};

    // if the status code is defined and there are examples for it, we attempt to use the example at the given index. Otherwise, fall back to the first example in that list.
    // this is the most specific example we can find
    let selectedExample = examplesByStatusCode[statusCode ?? ""]?.[responseIndex ?? 0];

    // if the status code is not found, we should attempt to find a different example that has the same status code
    if (statusCode != null) {
        selectedExample ??= Object.values(examplesByKeyAndStatusCode).find((examplesByStatusCode) => {
            const examples = examplesByStatusCode[statusCode];
            return examples != null && examples.length > 0;
        })?.[statusCode]?.[0];
    }

    // as a fallback, we attempt to use the first example under the current exampleId.
    // the exampleIndex is no longer relevant here, since we're using a fallback, so just return the first found example.
    selectedExample ??= Object.keys(examplesByStatusCode)
        .sort()
        .map((statusCode) => examplesByStatusCode[statusCode])
        .filter(isNonNullish)
        .find((examples) => examples.length > 0)?.[0];

    // if all else fails, lets return the first example that can be found under the selected language
    selectedExample ??= Object.values(examplesByKeyAndStatusCode)
        .flatMap((examples) => Object.values(examples))
        .flat()[0];

    // if that fails, then the current language has no examples, so we'll choose the first language
    selectedExample ??= Object.values(
        examplesByLanguageKeyAndStatusCode[
            getAvailableLanguages(examplesByLanguageKeyAndStatusCode, defaultLanguage)[0] ?? ""
        ] ?? {}
    )
        .flatMap((examples) => Object.values(examples))
        .flat()[0];

    // reverse lookup the selected example to get the actual key, examplesByStatusCode, and examplesByKeyAndStatusCode
    const reverseLookup =
        selectedExample != null
            ? reverseLookupSelectedExample(examplesByLanguageKeyAndStatusCode, selectedExample)
            : undefined;

    return {
        selectedExampleKey: reverseLookup?.key ?? key,
        selectedExample,
        examplesByStatusCode: reverseLookup?.examplesByStatusCode ?? examplesByStatusCode,
        examplesByKeyAndStatusCode: reverseLookup?.examplesByKeyAndStatusCode ?? examplesByKeyAndStatusCode
    };
}

/**
 * Reverse lookup the selected example to get the key, examplesByStatusCode, and examplesByKeyAndStatusCode.
 *
 * @param examplesByLanguageKeyAndStatusCode - The examples to reverse lookup.
 * @param selectedExample - The example to reverse lookup.
 * @returns The key, examplesByStatusCode, and examplesByKeyAndStatusCode for the selected example.
 */
export function reverseLookupSelectedExample(
    examplesByLanguageKeyAndStatusCode: ExamplesByLanguageKeyAndStatusCode,
    selectedExample: CodeExample
): {
    key: SelectedExampleKey;
    examplesByStatusCode: ExamplesByStatusCode;
    examplesByKeyAndStatusCode: ExamplesByKeyAndStatusCode;
} {
    const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode[selectedExample.language] ?? {};
    const examplesByStatusCode = examplesByKeyAndStatusCode[selectedExample.exampleKey] ?? {};
    const statusCode = String(selectedExample.exampleCall.responseStatusCode);
    const examples = examplesByStatusCode[statusCode] ?? [];
    const index = examples.findIndex((e) => e.key === selectedExample.key);
    return {
        key: {
            language: selectedExample.language,
            exampleKey: selectedExample.exampleKey,
            statusCode,
            responseIndex: index
        },
        examplesByStatusCode,
        examplesByKeyAndStatusCode
    };
}
