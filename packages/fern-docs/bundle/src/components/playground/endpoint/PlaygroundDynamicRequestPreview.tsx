"use client";

import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { SnippetResolver } from "@fern-api/snippets";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { t } from "@fern-docs/i18n";
import { useAtomValue } from "jotai";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { PLAYGROUND_AUTH_STATE_ATOM } from "@/state/playground";

import type { PlaygroundEndpointRequestFormState } from "../types";
import { returnSelectedOption } from "../utils/parse-auth-options";
import { usePlaygroundBaseUrl } from "../utils/select-environment";

export type DynamicSnippetLanguage = "typescript" | "python" | "java" | "ruby" | "csharp" | "go" | "php" | "swift";

interface PlaygroundDynamicRequestPreviewProps {
    context: EndpointContext;
    formState: PlaygroundEndpointRequestFormState;
    requestType: DynamicSnippetLanguage;
    dynamicIRsByLanguage: DynamicIRsByLanguage;
    lang: string;
}
export interface PlaygroundDynamicRequestPreviewRef {
    getCurrentCode: () => string;
}

// todo: support php
export const PlaygroundDynamicRequestPreview = forwardRef<
    PlaygroundDynamicRequestPreviewRef,
    PlaygroundDynamicRequestPreviewProps
>(({ context, formState, requestType, dynamicIRsByLanguage, lang }, ref) => {
    const [code, setCode] = useState<string>(t(lang).status.loading);
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    const [baseURL] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);

    useImperativeHandle(
        ref,
        () => ({
            getCurrentCode: () => code
        }),
        [code]
    );

    // create memoized snippet generators from the IR data
    const memoizedGenerators = useMemo(() => {
        try {
            const snippetInputs = [];
            const generators: Record<string, any> = {};

            // only process languages that have IR data
            if (dynamicIRsByLanguage.typescript) {
                snippetInputs.push({
                    language: "typescript" as const,
                    ir: dynamicIRsByLanguage.typescript as any
                });
            }

            if (dynamicIRsByLanguage.python) {
                snippetInputs.push({
                    language: "python" as const,
                    ir: dynamicIRsByLanguage.python as any
                });
            }

            if (dynamicIRsByLanguage.java) {
                snippetInputs.push({
                    language: "java" as const,
                    ir: dynamicIRsByLanguage.java as any
                });
            }

            if (dynamicIRsByLanguage.ruby) {
                snippetInputs.push({
                    language: "ruby" as const,
                    ir: dynamicIRsByLanguage.ruby as any
                });
            }

            if (dynamicIRsByLanguage.csharp) {
                snippetInputs.push({
                    language: "csharp" as const,
                    ir: dynamicIRsByLanguage.csharp as any
                });
            }

            if (dynamicIRsByLanguage.go) {
                snippetInputs.push({
                    language: "go" as const,
                    ir: dynamicIRsByLanguage.go as any
                });
            }

            if (dynamicIRsByLanguage.php) {
                snippetInputs.push({
                    language: "php" as const,
                    ir: dynamicIRsByLanguage.php as any
                });
            }

            if (dynamicIRsByLanguage.swift) {
                snippetInputs.push({
                    language: "swift" as const,
                    ir: dynamicIRsByLanguage.swift as any
                });
            }

            const snippetResolver = new SnippetResolver({ snippetInputs });

            // create endpoint generators only for languages that have IR data
            const endpointPath = `${context.endpoint.method} ${context.endpoint.path
                .map((p) => {
                    if (p.type === "pathParameter") {
                        return `{${p.value}}`;
                    }
                    return p.value;
                })
                .join("")}`;

            if (dynamicIRsByLanguage.typescript) {
                const typescriptSdk = snippetResolver.sdk("typescript");
                generators.typescript = typescriptSdk?.endpoint(endpointPath);
            }

            if (dynamicIRsByLanguage.python) {
                const pythonSdk = snippetResolver.sdk("python");
                generators.python = pythonSdk?.endpoint(endpointPath);
            }

            if (dynamicIRsByLanguage.java) {
                const javaSdk = snippetResolver.sdk("java");
                generators.java = javaSdk?.endpoint(endpointPath);
            }

            if (dynamicIRsByLanguage.ruby) {
                const rubySdk = snippetResolver.sdk("ruby");
                generators.ruby = rubySdk?.endpoint(endpointPath);
            }

            if (dynamicIRsByLanguage.csharp) {
                const csharpSdk = snippetResolver.sdk("csharp");
                generators.csharp = csharpSdk?.endpoint(endpointPath);
            }

            if (dynamicIRsByLanguage.go) {
                const goSdk = snippetResolver.sdk("go");
                generators.go = goSdk?.endpoint(endpointPath);
            }

            if (dynamicIRsByLanguage.php) {
                const phpSdk = snippetResolver.sdk("php");
                generators.php = phpSdk?.endpoint(endpointPath);
            }

            if (dynamicIRsByLanguage.swift) {
                const swiftSdk = snippetResolver.sdk("swift");
                generators.swift = swiftSdk?.endpoint(endpointPath);
            }

            return generators;
        } catch (error) {
            console.error("Error creating snippet generators:", error);
            return null;
        }
    }, [dynamicIRsByLanguage, context.endpoint.method, context.endpoint.path]);

    useEffect(() => {
        const generateCode = () => {
            try {
                if (!memoizedGenerators) {
                    setCode(t(lang).errors.failedToCreateSnippetGenerators);
                    return;
                }

                const generator = memoizedGenerators[requestType];
                if (!generator) {
                    setCode(`No SDK snippet available for ${requestType}`);
                    return;
                }

                let auth;
                // hack: just parse the bearer token if oauth enabled
                if (authState.bearerAuth) {
                    const token = returnSelectedOption(authState.bearerAuth.token).value;

                    auth = {
                        type: "bearer",
                        token: token
                    };
                } else {
                    auth = authState;
                }

                // todo: support environments
                const request = {
                    baseURL,
                    auth,
                    pathParameters: formState.pathParameters,
                    queryParameters: formState.queryParameters,
                    headers: formState.headers,
                    requestBody: formState.body?.value
                };

                const result = generator.generateSync(request);

                setCode(result.snippet ?? t(lang).errors.errorGeneratingCodeSnippet);
            } catch (error: unknown) {
                console.error(`Error generating ${requestType} snippet:`, error);
                const errorMessage = error instanceof Error ? error.message : t(lang).status.unknownError;
                setCode(`Failed to generate ${requestType} code: ${errorMessage}`);
            }
        };

        generateCode();
    }, [requestType, memoizedGenerators, formState, baseURL, authState]);

    return (
        <FernSyntaxHighlighter
            className="relative min-h-0 flex-1 shrink select-text"
            language={requestType}
            code={code}
            fontSize="sm"
            id={context.endpoint.id}
        />
    );
});

PlaygroundDynamicRequestPreview.displayName = "PlaygroundDynamicRequestPreview";
