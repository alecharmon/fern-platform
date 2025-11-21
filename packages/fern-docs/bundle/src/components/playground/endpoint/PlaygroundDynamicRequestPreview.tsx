"use client";

import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { t } from "@fern-docs/i18n";
import { useAtomValue } from "jotai";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { PLAYGROUND_AUTH_STATE_ATOM, PLAYGROUND_SELECTED_AUTH_TYPE_ATOM } from "@/state/playground";

import type { PlaygroundEndpointRequestFormState } from "../types";
import { returnSelectedOption } from "../utils/parse-auth-options";
import { usePlaygroundBaseUrl } from "../utils/select-environment";

type SnippetsModule = typeof import("@fern-api/snippets");
let snippetsModulePromise: Promise<SnippetsModule> | null = null;

function loadSnippetsModule(): Promise<SnippetsModule> {
    if (snippetsModulePromise == null) {
        snippetsModulePromise = import("@fern-api/snippets").catch((err) => {
            snippetsModulePromise = null;
            throw err;
        });
    }
    return snippetsModulePromise;
}

type SnippetsLoadState =
    | { status: "loading" }
    | { status: "loaded"; module: SnippetsModule }
    | { status: "error"; error: unknown };

export type DynamicSnippetLanguage = "typescript" | "python" | "java" | "ruby" | "csharp" | "go" | "php" | "swift";

interface PlaygroundDynamicRequestPreviewProps {
    context: EndpointContext;
    formState: PlaygroundEndpointRequestFormState;
    requestType: DynamicSnippetLanguage;
    dynamicIRsByLanguage?: DynamicIRsByLanguage;
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
    const [snippetsLoad, setSnippetsLoad] = useState<SnippetsLoadState>({ status: "loading" });
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);
    const [baseURL] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);

    useEffect(() => {
        let cancelled = false;
        loadSnippetsModule()
            .then((module) => {
                if (!cancelled) {
                    setSnippetsLoad({ status: "loaded", module });
                }
            })
            .catch((error) => {
                console.error("Failed to load @fern-api/snippets", error);
                if (!cancelled) {
                    setSnippetsLoad({ status: "error", error });
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            getCurrentCode: () => code
        }),
        [code]
    );

    // create memoized snippet generators from the IR data
    const memoizedGenerators = useMemo<Record<string, any> | null | undefined>(() => {
        if (snippetsLoad.status !== "loaded") {
            return undefined;
        }

        try {
            const irs = dynamicIRsByLanguage ?? {};
            const snippetInputs = [];
            const generators: Record<string, any> = {};

            // only process languages that have IR data
            if (irs.typescript) {
                snippetInputs.push({
                    language: "typescript" as const,
                    ir: irs.typescript as any
                });
            }

            if (irs.python) {
                snippetInputs.push({
                    language: "python" as const,
                    ir: irs.python as any
                });
            }

            if (irs.java) {
                snippetInputs.push({
                    language: "java" as const,
                    ir: irs.java as any
                });
            }

            if (irs.ruby) {
                snippetInputs.push({
                    language: "ruby" as const,
                    ir: irs.ruby as any
                });
            }

            if (irs.csharp) {
                snippetInputs.push({
                    language: "csharp" as const,
                    ir: irs.csharp as any
                });
            }

            if (irs.go) {
                snippetInputs.push({
                    language: "go" as const,
                    ir: irs.go as any
                });
            }

            if (irs.php) {
                snippetInputs.push({
                    language: "php" as const,
                    ir: irs.php as any
                });
            }

            if (irs.swift) {
                snippetInputs.push({
                    language: "swift" as const,
                    ir: irs.swift as any
                });
            }
            if (snippetInputs.length === 0) {
                return generators;
            }

            const snippetResolver = new snippetsLoad.module.SnippetResolver({ snippetInputs });

            // create endpoint generators only for languages that have IR data
            const endpointPath = `${context.endpoint.method} ${context.endpoint.path
                .map((p) => {
                    if (p.type === "pathParameter") {
                        return `{${p.value}}`;
                    }
                    return p.value;
                })
                .join("")}`;

            if (irs.typescript) {
                const typescriptSdk = snippetResolver.sdk("typescript");
                generators.typescript = typescriptSdk?.endpoint(endpointPath);
            }

            if (irs.python) {
                const pythonSdk = snippetResolver.sdk("python");
                generators.python = pythonSdk?.endpoint(endpointPath);
            }

            if (irs.java) {
                const javaSdk = snippetResolver.sdk("java");
                generators.java = javaSdk?.endpoint(endpointPath);
            }

            if (irs.ruby) {
                const rubySdk = snippetResolver.sdk("ruby");
                generators.ruby = rubySdk?.endpoint(endpointPath);
            }

            if (irs.csharp) {
                const csharpSdk = snippetResolver.sdk("csharp");
                generators.csharp = csharpSdk?.endpoint(endpointPath);
            }

            if (irs.go) {
                const goSdk = snippetResolver.sdk("go");
                generators.go = goSdk?.endpoint(endpointPath);
            }

            if (irs.php) {
                const phpSdk = snippetResolver.sdk("php");
                generators.php = phpSdk?.endpoint(endpointPath);
            }

            if (irs.swift) {
                const swiftSdk = snippetResolver.sdk("swift");
                generators.swift = swiftSdk?.endpoint(endpointPath);
            }

            return generators;
        } catch (error) {
            console.error("Error creating snippet generators:", error);
            return null;
        }
    }, [dynamicIRsByLanguage, context.endpoint.method, context.endpoint.path, snippetsLoad]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: also runs when selectedAuthType changes
    useEffect(() => {
        const generateCode = () => {
            try {
                if (snippetsLoad.status === "loading") {
                    setCode(t(lang).status.loading);
                    return;
                }

                if (snippetsLoad.status === "error") {
                    setCode("Failed to load code generators. Please refresh and try again.");
                    return;
                }

                if (memoizedGenerators === undefined) {
                    setCode(t(lang).status.loading);
                    return;
                }

                if (memoizedGenerators === null) {
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
    }, [requestType, memoizedGenerators, formState, baseURL, authState, lang, selectedAuthType, snippetsLoad]);

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
