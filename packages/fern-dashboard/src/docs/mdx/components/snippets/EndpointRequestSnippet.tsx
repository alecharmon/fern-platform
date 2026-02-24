"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { useDefaultProgrammingLanguage, useProgrammingLanguage } from "@fern-docs/components/state/language";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { ChevronDown } from "lucide-react";
import { useMemo, useRef } from "react";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";

import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";

import { EditorPreviewBanner } from "./EditorPreviewBanner";
import { EndpointNotFoundState } from "./EndpointNotFoundState";

const PAYLOAD_LANGUAGE = "payload";

export const EMPTY_ENDPOINT_REQUEST_SNIPPET = `
<EndpointRequestSnippet endpoint="" />
`;

export function EndpointRequestSnippet({
    endpoint,
    example,
    endpointDefinition,
    slugs,
    className,
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
     * @internal the rehype-endpoint-examples-snippets plugin will set this
     */
    endpointDefinition?: ApiDefinition.EndpointDefinition;
    /**
     * @internal the rehype-endpoint-examples-snippets plugin will set this
     */
    slugs?: string[];
    className?: string;
    /**
     * Specifies which languages to show and in what order.
     * If not provided, all available languages will be shown with "payload" at the end.
     * Use "payload" to include the request payload option.
     */
    languages?: string[];
}) {
    const { isWithinEditor } = useEditorComponent();
    const snippetRef = useRef<HTMLDivElement>(null);

    if (endpointDefinition == null) {
        const notFoundContent = <EndpointNotFoundState endpointProp={endpoint} snippetRef={snippetRef} />;

        if (isWithinEditor) {
            return (
                <EditorComponentPopoverProvider
                    attributes={{
                        endpoint: new TextInputControl({ defaultValue: endpoint })
                    }}
                    targetRef={snippetRef}
                    buttonAlwaysVisible
                >
                    {notFoundContent}
                </EditorComponentPopoverProvider>
            );
        }

        return notFoundContent;
    }

    return (
        <EndpointRequestSnippetInternal
            endpoint={endpointDefinition}
            slugs={slugs ?? []}
            example={example}
            className={className}
            endpointProp={endpoint}
            languages={languages}
        />
    );
}

function EndpointRequestSnippetInternal({
    endpoint,
    example,
    className,
    endpointProp,
    languages
}: {
    endpoint: ApiDefinition.EndpointDefinition;
    example: string | undefined;
    slugs: string[];
    className?: string;
    endpointProp?: string;
    languages?: string[];
}) {
    const { isWithinEditor } = useEditorComponent();
    const [globalLanguage, setGlobalLanguage] = useProgrammingLanguage();
    const defaultLanguage = useDefaultProgrammingLanguage();
    const snippetRef = useRef<HTMLDivElement>(null);

    // Find the first example if no specific example is requested
    const selectedExample = endpoint.examples?.[0];
    const snippets = selectedExample?.snippets;

    // Get available languages from snippets
    const availableLanguages = snippets ? Object.keys(snippets) : [];

    // Add "payload" option if there's a request body or query params
    const hasPayload =
        selectedExample?.requestBody != null ||
        (selectedExample?.queryParameters != null && Object.keys(selectedExample.queryParameters).length > 0);

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

    // Determine which language to use: prefer globalLanguage, then defaultLanguage, then curl, then first available
    const selectedLanguage = useMemo(() => {
        let lang = globalLanguage;
        if (!languagesWithPayload.includes(lang)) {
            if (languagesWithPayload.includes(defaultLanguage)) {
                lang = defaultLanguage;
            } else if (languagesWithPayload.includes("curl")) {
                lang = "curl";
            } else {
                lang = languagesWithPayload[0] ?? "bash";
            }
        }
        return lang;
    }, [globalLanguage, languagesWithPayload, defaultLanguage]);

    // Determine if payload is selected
    const isPayloadSelected = selectedLanguage === PAYLOAD_LANGUAGE;

    // Get the code for the selected language
    const payloadCode = useMemo(() => {
        if (!isPayloadSelected || selectedExample == null) {
            return "";
        }
        const { requestBody, queryParameters } = selectedExample;
        // For requests with a body, show the request body JSON
        if (requestBody != null) {
            if (requestBody.type === "json") {
                return JSON.stringify(requestBody.value, null, 2);
            }
            if (requestBody.type === "form") {
                return JSON.stringify(requestBody.value, null, 2);
            }
        }
        // For GET requests or requests without a body, show query parameters
        if (queryParameters != null && Object.keys(queryParameters).length > 0) {
            return JSON.stringify(queryParameters, null, 2);
        }
        return "{}";
    }, [isPayloadSelected, selectedExample]);

    // Early returns after all hooks
    if (selectedExample == null || snippets == null) {
        return null;
    }

    const languageSnippets = snippets[selectedLanguage as keyof typeof snippets];
    const snippetCode = languageSnippets?.[0]?.code ?? "";
    const code = isPayloadSelected ? payloadCode : snippetCode;
    const displayLanguage = isPayloadSelected ? "json" : selectedLanguage;

    if (!code && !isPayloadSelected) {
        return null;
    }

    const dropdownOptions = languagesWithPayload.map((language) => ({
        type: "value" as const,
        label: getLanguageDisplayName(language),
        value: language,
        className: "group/option",
        icon: (
            <FaIcon
                className="size-icon-sm text-body group-data-[highlighted]/option:text-(color:--accent-contrast)"
                icon={getIconForClient(language)}
            />
        )
    }));

    const selectedOption = dropdownOptions.find((option) => option.value === selectedLanguage);

    const snippetContent = (
        <div ref={snippetRef} className={className}>
            <div className="bg-card-background border-card-border rounded-3 shadow-card-grayscale relative flex flex-col overflow-hidden border">
                {isWithinEditor && (
                    <EditorComponentPopoverButton
                        className="absolute right-2 top-0.5 z-10"
                        componentName="Endpoint Request Snippet"
                    />
                )}
                <div className="border-card-border rounded-t-inherit flex min-h-10 items-center justify-between border-b px-2">
                    <EndpointUrlWithOverflow
                        path={endpoint.path}
                        method={endpoint.method}
                        hideCopyButton={true}
                        className="min-w-0 flex-1"
                        lang="en"
                    />
                    {languagesWithPayload.length > 1 && (
                        <FernDropdown
                            lang="en"
                            value={selectedLanguage}
                            options={dropdownOptions}
                            onValueChange={setGlobalLanguage}
                            className="mr-9"
                        >
                            <FernButton
                                icon={
                                    <FaIcon
                                        className="text-(color:--accent-a11) size-4"
                                        icon={getIconForClient(selectedLanguage)}
                                    />
                                }
                                rightIcon={<ChevronDown className="!size-icon" />}
                                text={selectedOption?.label ?? getLanguageDisplayName(selectedLanguage)}
                                size="small"
                                variant="outlined"
                                mono={true}
                            />
                        </FernDropdown>
                    )}
                </div>
                <FernSyntaxHighlighter
                    className="rounded-b-inherit rounded-t-none"
                    style={{ maxHeight: "500px" }}
                    language={displayLanguage}
                    fontSize="sm"
                    code={code}
                />
                <EditorPreviewBanner name="EndpointRequestSnippet" />
            </div>
        </div>
    );

    if (isWithinEditor) {
        return (
            <EditorComponentPopoverProvider
                attributes={{
                    endpoint: new TextInputControl({ defaultValue: endpointProp })
                }}
                targetRef={snippetRef}
                buttonAlwaysVisible
            >
                {snippetContent}
            </EditorComponentPopoverProvider>
        );
    }

    return snippetContent;
}

function getLanguageDisplayName(language: string): string {
    switch (language) {
        case "payload":
            return "Payload";
        case "curl":
            return "cURL";
        case "go":
        case "golang":
            return "Go";
        case ".net":
            return ".NET";
        case "c#":
        case "csharp":
            return "C#";
        case "javascript":
            return "JavaScript";
        case "typescript":
            return "TypeScript";
        case "python":
            return "Python";
        case "java":
            return "Java";
        case "ruby":
            return "Ruby";
        case "php":
            return "PHP";
        default:
            return language.charAt(0).toUpperCase() + language.slice(1);
    }
}

function getIconForClient(language: string): string {
    switch (language) {
        case "payload":
            return "fa-solid fa-brackets-curly";
        case "curl":
        case "shell":
        case "bash":
            return "fa-solid fa-terminal";
        case "python":
            return "fa-brands fa-python";
        case "javascript":
        case "typescript":
            return "fa-brands fa-js";
        case "go":
        case "golang":
            return "fa-brands fa-golang";
        case "ruby":
            return "fa-solid fa-gem";
        case "java":
            return "fa-brands fa-java";
        case "kotlin":
            return "fa-brands fa-android";
        case ".net":
        case "dotnet":
        case "c#":
        case "csharp":
            return "fa-brands fa-microsoft";
        case "php":
            return "fa-brands fa-php";
        case "swift":
            return "fa-brands fa-swift";
        case "rust":
            return "fa-brands fa-rust";
        default:
            return "fa-solid fa-code";
    }
}
