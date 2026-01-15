import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { EMPTY_OBJECT } from "@fern-api/ui-core-utils";
import { CodeExampleClientDropdown } from "@fern-docs/components/api-reference/endpoints/CodeExampleClientDropdown";
import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";
import {
    PAYLOAD_LANGUAGE,
    useExampleSelection
} from "@fern-docs/components/api-reference/endpoints/useExampleSelection";
import { CodeSnippetExample } from "@fern-docs/components/api-reference/examples/CodeSnippetExample";
import { cn } from "@fern-docs/components/cn";
import { useCurrentVersionSlug } from "@fern-docs/components/state/navigation";
import { type ReactElement, useMemo } from "react";
import { ApiReferenceButton } from "@/components/ApiReferenceButton";
import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";

export function EndpointRequestSnippet({
    example,
    endpointDefinition,
    slugs,
    lang,
    className,
    highlight,
    languages
}: {
    /**
     * The endpoint locator to use for the request snippet.
     */
    endpoint?: string;
    /**
     * The example to use for the request snippet.
     */
    example?: string | undefined;
    /**
     * @internal the rehype-endpoint--examples-snippets plugin will set this
     */
    endpointDefinition?: ApiDefinition.EndpointDefinition;
    /**
     * @internal the rehype-endpoint-examples-snippets plugin will set this
     */
    slugs?: string[];
    lang?: string;
    className?: string;
    /**
     * Sets the lines to highlight
     */
    highlight?: number | number[];
    /**
     * Specifies which languages to show and in what order.
     * If not provided, all available languages will be shown with "payload" at the end.
     * Use "payload" to include the request payload option.
     */
    languages?: string[];
}) {
    if (endpointDefinition == null) {
        return null;
    }

    return (
        <EndpointRequestSnippetInternal
            endpoint={endpointDefinition}
            slugs={slugs ?? []}
            example={example}
            className={className}
            lang={lang ?? "en"}
            highlight={highlight}
            languages={languages}
        />
    );
}

function EndpointRequestSnippetInternal({
    endpoint,
    example,
    slugs,
    className,
    lang,
    highlight,
    languages
}: {
    endpoint: ApiDefinition.EndpointDefinition;
    example: string | undefined;
    slugs: string[];
    lang: string;
    className?: string;
    highlight?: number | number[];
    languages?: string[];
}): ReactElement<any> | null {
    const slug = useCurrentSlug(slugs);
    const { selectedExample, selectedExampleKey, availableLanguages, setSelectedExampleKey } = useExampleSelection(
        endpoint,
        example
    );

    const [baseUrl, selectedEnvironmentId] = usePlaygroundBaseUrl(endpoint);

    // Add "payload" option to available languages if there's a request body or query params
    const hasPayload =
        selectedExample?.exampleCall.requestBody != null ||
        (selectedExample?.exampleCall.queryParameters != null &&
            Object.keys(selectedExample.exampleCall.queryParameters).length > 0);

    const languagesWithPayload = useMemo(() => {
        // If languages prop is provided, use it to filter and order
        if (languages != null && languages.length > 0) {
            return languages.filter((lang) => {
                // Include payload if it's in the list and hasPayload is true
                if (lang === PAYLOAD_LANGUAGE) {
                    return hasPayload;
                }
                // Include other languages only if they're available
                return availableLanguages.includes(lang);
            });
        }
        // Default behavior: all available languages with payload at the end
        if (!hasPayload) {
            return availableLanguages;
        }
        return [...availableLanguages, PAYLOAD_LANGUAGE];
    }, [availableLanguages, hasPayload, languages]);

    // Check if payload is selected based on the hook's selectedExampleKey
    const isPayloadSelected = selectedExampleKey.language === PAYLOAD_LANGUAGE;

    const payloadCode = useMemo(() => {
        if (!isPayloadSelected || selectedExample == null) {
            return "";
        }
        const { requestBody, queryParameters } = selectedExample.exampleCall;
        // Check for requestBodyV3 first (typed version with type/value structure)
        const requestBodyV3 = (selectedExample.exampleCall as { requestBodyV3?: { type: string; value: unknown } })
            .requestBodyV3;
        if (requestBodyV3 != null) {
            if (requestBodyV3.type === "json" || requestBodyV3.type === "form") {
                // Make sure value exists and is not undefined
                if (requestBodyV3.value !== undefined) {
                    return JSON.stringify(requestBodyV3.value, null, 2);
                }
            }
        }
        // Fall back to requestBody (untyped version)
        if (requestBody != null) {
            // If it has type/value structure with an actual value, use it
            if (typeof requestBody === "object" && "type" in requestBody) {
                const typed = requestBody as { type: string; value?: unknown };
                if ((typed.type === "json" || typed.type === "form") && typed.value !== undefined) {
                    return JSON.stringify(typed.value, null, 2);
                }
                // If type exists but value is missing, the data might not be populated
                // Skip this and try other fallbacks
            } else {
                // requestBody is the actual value (not wrapped in type/value structure)
                return JSON.stringify(requestBody, null, 2);
            }
        }
        // For GET requests or requests without a body, show query parameters
        if (queryParameters != null && Object.keys(queryParameters).length > 0) {
            return JSON.stringify(queryParameters, null, 2);
        }
        return "{}";
    }, [isPayloadSelected, selectedExample]);

    // Ensure displayCode is always a string to prevent "Cannot read properties of undefined (reading 'split')" errors
    const displayCode = isPayloadSelected ? (payloadCode ?? "") : (selectedExample?.code ?? "");
    const displayLanguage = isPayloadSelected ? "json" : selectedExampleKey.language;

    if (selectedExample == null) {
        return null;
    }

    // Additional safety check - if displayCode is still undefined/null, don't render
    if (displayCode == null) {
        return null;
    }

    return (
        <div className={cn("mb-5 mt-3", className)}>
            <CodeSnippetExample
                title={
                    <EndpointUrlWithOverflow
                        path={endpoint.path}
                        method={endpoint.method}
                        environmentId={selectedEnvironmentId}
                        baseUrl={baseUrl}
                        options={endpoint.environments}
                        hideCopyButton={true}
                        lang={lang}
                    />
                }
                lang={lang}
                languageDropdown={
                    <>
                        {languagesWithPayload.length > 1 && (
                            <CodeExampleClientDropdown
                                languages={languagesWithPayload}
                                onValueChange={(language) =>
                                    setSelectedExampleKey((prev) => ({
                                        ...prev,
                                        language
                                    }))
                                }
                                value={selectedExampleKey.language}
                                lang={lang}
                            />
                        )}
                        {slug != null && <ApiReferenceButton slug={slug} lang={lang} />}
                    </>
                }
                code={displayCode}
                language={displayLanguage}
                json={EMPTY_OBJECT}
                scrollAreaStyle={{ maxHeight: "500px" }}
                highlight={highlight}
            />
        </div>
    );
}

function useCurrentSlug(slugs: string[]): string | undefined {
    const currentVersionSlug = useCurrentVersionSlug();

    if (slugs.length === 0) {
        return undefined;
    }

    if (slugs.length === 1 && slugs[0]) {
        return slugs[0];
    }

    if (currentVersionSlug == null) {
        return slugs[0];
    }

    const slug = slugs.find((slug) => slug.startsWith(currentVersionSlug + "/"));
    return slug ?? slugs[0];
}
