"use client";

import { EndpointUrlWithOverflow } from "@fern-api/endpoint-snippet-dependencies";
import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FaIcon } from "@fern-docs/components/fa-icon";
import { useDefaultProgrammingLanguage, useProgrammingLanguage } from "@fern-docs/components/state/language";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";

import { EditorPreviewBanner } from "./EditorPreviewBanner";
import { EndpointNotFoundState } from "./EndpointNotFoundState";

/* eslint-disable unused-imports/no-unused-vars */

export const EMPTY_ENDPOINT_REQUEST_SNIPPET = `
<EndpointRequestSnippet endpoint="" />
`;

export function EndpointRequestSnippet({
    endpoint,
    example,
    endpointDefinition,
    slugs,
    className
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
        />
    );
}

function EndpointRequestSnippetInternal({
    endpoint,
    example,
    className,
    endpointProp
}: {
    endpoint: ApiDefinition.EndpointDefinition;
    example: string | undefined;
    slugs: string[];
    className?: string;
    endpointProp?: string;
}) {
    const { isWithinEditor } = useEditorComponent();
    const [globalLanguage, setGlobalLanguage] = useProgrammingLanguage();
    const defaultLanguage = useDefaultProgrammingLanguage();
    const snippetRef = useRef<HTMLDivElement>(null);

    // Find the first example if no specific example is requested
    const selectedExample = endpoint.examples?.[0];

    if (selectedExample == null) {
        return null;
    }

    const snippets = selectedExample.snippets;
    if (!snippets) {
        return null;
    }

    // Get available languages from snippets
    const availableLanguages = Object.keys(snippets);

    // Determine which language to use: prefer globalLanguage, then defaultLanguage, then curl, then first available
    let selectedLanguage = globalLanguage;
    if (!availableLanguages.includes(selectedLanguage)) {
        if (availableLanguages.includes(defaultLanguage)) {
            selectedLanguage = defaultLanguage;
        } else if (availableLanguages.includes("curl")) {
            selectedLanguage = "curl";
        } else {
            selectedLanguage = availableLanguages[0] ?? "bash";
        }
    }

    // Get the code for the selected language
    const languageSnippets = snippets[selectedLanguage as keyof typeof snippets];
    const code = languageSnippets?.[0]?.code ?? "";

    if (!code) {
        return null;
    }

    const dropdownOptions = availableLanguages.map((language) => ({
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
                    />
                    {availableLanguages.length > 0 && (
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
                    language={selectedLanguage}
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
