"use client";

import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { AuthScheme, EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { t } from "@fern-docs/i18n";
import { useAtomValue } from "jotai";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { PLAYGROUND_AUTH_STATE_ATOM } from "@/state/playground";
import { getHeaderStorageKey } from "../auth/PlaygroundHeaderAuthForm";
import type { PlaygroundAuthState, PlaygroundEndpointRequestFormState } from "../types";
import { getAuthKey } from "../utils";
import { returnSelectedOption } from "../utils/parse-auth-options";
import { usePlaygroundBaseUrl, useSelectedEnvironment } from "../utils/select-environment";

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

/**
 * Extracts a token/value from any non-empty auth state field.
 * Used as a fallback when the primary auth field for the scheme type is empty,
 * e.g. when the IR expects header auth but the user entered a bearer token.
 */
function getFallbackAuthValue(authState: PlaygroundAuthState): string {
    if (authState.bearerAuth?.token) {
        const val = returnSelectedOption(authState.bearerAuth.token).value;
        if (val) {
            return val;
        }
    }
    if (authState.header?.headers) {
        for (const val of Object.values(authState.header.headers)) {
            if (val) {
                return val;
            }
        }
    }
    if (authState.oauth) {
        const token =
            authState.oauth.selectedInputMethod === "credentials"
                ? authState.oauth.accessToken
                : authState.oauth.userSuppliedAccessToken;
        if (token) {
            return token;
        }
    }
    return "";
}

/**
 * Builds the auth object for the snippets library based on the first auth scheme
 * (matching the Dynamic IR). Falls back across auth state fields so that any
 * user-entered value is reflected in the snippet regardless of which auth option
 * they selected in the UI.
 */
function buildSnippetAuth(
    firstAuthScheme: AuthScheme | undefined,
    authState: PlaygroundAuthState,
    authKey: string | undefined
): Record<string, unknown> | undefined {
    if (!firstAuthScheme) {
        return undefined;
    }

    switch (firstAuthScheme.type) {
        case "bearerAuth": {
            const token =
                returnSelectedOption(authState.bearerAuth?.token ?? "").value || getFallbackAuthValue(authState);
            return {
                type: "bearer",
                token
            };
        }
        case "basicAuth": {
            return {
                type: "basic",
                username: authState.basicAuth?.username ?? "",
                password: authState.basicAuth?.password ?? ""
            };
        }
        case "header": {
            const storageKey = authKey
                ? getHeaderStorageKey(authKey, firstAuthScheme.headerWireValue)
                : firstAuthScheme.headerWireValue;
            const value = authState.header?.headers[storageKey] || getFallbackAuthValue(authState);
            return {
                type: "header",
                value
            };
        }
        case "oAuth": {
            const token =
                authState.oauth?.selectedInputMethod === "credentials"
                    ? authState.oauth?.accessToken
                    : (authState.oauth?.userSuppliedAccessToken ?? "");
            return {
                type: "bearer",
                token: token || getFallbackAuthValue(authState)
            };
        }
        default:
            return undefined;
    }
}

export const PlaygroundDynamicRequestPreview = forwardRef<
    PlaygroundDynamicRequestPreviewRef,
    PlaygroundDynamicRequestPreviewProps
>(({ context, formState, requestType, dynamicIRsByLanguage, lang }, ref) => {
    const [code, setCode] = useState<string>(t(lang).status.loading);
    const [snippetsLoad, setSnippetsLoad] = useState<SnippetsLoadState>({ status: "loading" });
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    const [baseURL, environmentId] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);
    const selectedEnvironment = useSelectedEnvironment(context.endpoint);

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

                // Always use the first auth scheme to match the Dynamic IR's auth type.
                // The Dynamic IR picks a single auth type per endpoint (the first one),
                // so we must send values matching that type regardless of the user's UI selection.
                const firstEntry =
                    context.authOptionEntries.length > 0
                        ? context.authOptionEntries[0]
                        : context.authsWithKeys[0]
                          ? {
                                key: getAuthKey(context.authsWithKeys[0]),
                                schemeIds: [context.authsWithKeys[0].key],
                                schemes: [context.authsWithKeys[0].scheme],
                                label: String(context.authsWithKeys[0].key)
                            }
                          : undefined;

                const firstAuthScheme = firstEntry?.schemes[0];
                const authKey = firstEntry?.schemeIds[0] != null ? String(firstEntry.schemeIds[0]) : undefined;

                const auth = buildSnippetAuth(firstAuthScheme, authState, authKey);

                const environments = context.endpoint.environments;
                const isCustomUrl =
                    baseURL != null && selectedEnvironment != null && baseURL !== selectedEnvironment.baseUrl;

                let snippetBaseURL: string | undefined;
                let snippetEnvironment: string | undefined;

                if (isCustomUrl) {
                    snippetBaseURL = baseURL;
                } else if (environments != null && environments.length > 1 && environmentId != null) {
                    snippetEnvironment = environmentId;
                }

                const request = {
                    baseURL: snippetBaseURL,
                    environment: snippetEnvironment,
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
    }, [
        requestType,
        memoizedGenerators,
        formState,
        baseURL,
        environmentId,
        selectedEnvironment,
        context.endpoint.environments,
        authState,
        lang,
        snippetsLoad,
        context.authOptionEntries,
        context.authsWithKeys
    ]);

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
