"use client";

import {
    buildEndpointUrl,
    type EndpointDefinition,
    PropertyKey,
    type TypeDefinition
} from "@fern-api/fdr-sdk/api-definition";
import { unknownToString } from "@fern-api/ui-core-utils";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { FernButton } from "@fern-docs/components/FernButton";
import { FernCard } from "@fern-docs/components/FernCard";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { jotaiStore } from "@fern-docs/components/state/jotai-provider";
import { failed, type Loadable, loaded, loading, notStartedLoading } from "@fern-ui/loadable";
import { round } from "es-toolkit/math";
import { mapValues } from "es-toolkit/object";
import { ChevronDown, RotateCcw, SendHorizonal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EndpointUrlWithOverflow } from "@/components/api-reference/endpoints/EndpointUrlWithOverflow";
import { executeProxyRest } from "@/components/playground/fetch-utils/executeProxyRest";
import { PlaygroundObjectPropertiesForm } from "@/components/playground/form/PlaygroundObjectPropertyForm";
import type { PlaygroundEndpointRequestFormState, ProxyRequest } from "@/components/playground/types";
import type { PlaygroundResponse } from "@/components/playground/types/playgroundResponse";
import {
    buildAuthHeaders,
    getInitialEndpointRequestFormStateWithExample,
    serializeFormStateBody
} from "@/components/playground/utils";
import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";
import { isLocal } from "@/components/playground/utils/utils";
import { Json } from "@/mdx/components/json/JSON";
import { PLAYGROUND_AUTH_STATE_ATOM, useResolvedPlaygroundState } from "@/state/playground";

interface RunnableEndpointProps {
    /**
     * The endpoint locator (e.g., "POST /api/users").
     */
    endpoint?: string;

    /**
     * The example to pre-fill the form with.
     */
    example?: string;

    /**
     * @internal the rehype-runnable-endpoint plugin will set this
     */
    endpointDefinition?: EndpointDefinition;

    /**
     * @internal the rehype-runnable-endpoint plugin will set this
     */
    types?: Record<string, TypeDefinition>;

    /**
     * @internal the rehype-runnable-endpoint plugin will set this
     */
    globalHeaders?: EndpointDefinition["requestHeaders"];

    /**
     * Optional className for styling
     */
    className?: string;
}

function RunnableEndpointResponsePreview({ response }: { response: PlaygroundResponse }) {
    // For other response types, show as text
    const responseText = useMemo(() => {
        if (typeof response.response.body === "string") {
            return response.response.body;
        }
        return JSON.stringify(response.response.body, null, 2);
    }, [response]);

    // Custom clipboard handler that removes quotes from strings
    const handleCopy = useCallback((copy: { src: unknown }) => {
        const value = copy.src;
        let textToCopy: string;

        if (typeof value === "string") {
            // For strings, copy without quotes
            textToCopy = value;
        } else if (typeof value === "object" && value != null) {
            // For objects and arrays, stringify
            textToCopy = JSON.stringify(value, null, 2);
        } else {
            // For numbers, booleans, null
            textToCopy = String(value);
        }

        // Copy to clipboard
        navigator.clipboard.writeText(textToCopy).catch((err: unknown) => {
            console.error("Failed to copy to clipboard:", err);
        });
    }, []);

    // For JSON responses, use the interactive JSON viewer
    if (response.type === "json" && typeof response.response.body === "object") {
        return (
            <div className="runnable-endpoint-response max-h-[390px] overflow-auto p-3">
                <style>
                    {`
                        .runnable-endpoint-response .react-json-view {
                            /* Hide all copy icons by default */
                            .copy-to-clipboard-container {
                                opacity: 0;
                                position: absolute;
                                margin-left: 8px;
                                transition: opacity 0.15s ease;
                                pointer-events: none;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                vertical-align: middle;
                                min-width: 16px;
                                min-height: 16px;
                            }

                            /* Make container relative for absolute positioning of children */
                            .copy-to-clipboard-container {
                                position: relative;
                                width: 16px;
                                height: 16px;
                            }

                            /* Position both copy icon and checkmark in the same spot */
                            .copy-to-clipboard-container svg,
                            .copy-to-clipboard-container > div,
                            .copy-to-clipboard-container > span {
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                transform: translate(-50%, -50%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                width: 16px;
                                height: 16px;
                            }

                            /* Only show copy icon on direct hover of the value row */
                            .object-content > .variable-row:hover > .copy-to-clipboard-container,
                            .pushed-content > .variable-row:hover > .copy-to-clipboard-container {
                                opacity: 1;
                                pointer-events: auto;
                            }

                            /* Prevent parent hover from showing child copy icons */
                            .object-content > .variable-row:hover .object-content .copy-to-clipboard-container,
                            .pushed-content > .variable-row:hover .pushed-content .copy-to-clipboard-container {
                                opacity: 0;
                                pointer-events: none;
                            }

                            /* Re-enable for nested direct hovers */
                            .object-content > .variable-row:hover .object-content > .variable-row:hover > .copy-to-clipboard-container,
                            .pushed-content > .variable-row:hover .pushed-content > .variable-row:hover > .copy-to-clipboard-container {
                                opacity: 1;
                                pointer-events: auto;
                            }
                        }
                    `}
                </style>
                <Json
                    json={response.response.body}
                    enableFernClipboard={false}
                    jsonViewProps={
                        {
                            enableClipboard: handleCopy,
                            collapsed: 2
                        } as any
                    }
                />
            </div>
        );
    }

    return (
        <div className="max-h-[390px] overflow-auto">
            <pre className="text-code-sm m-0 select-text p-4 font-mono">{responseText}</pre>
        </div>
    );
}

export function RunnableEndpoint({
    endpointDefinition,
    types,
    globalHeaders,
    example,
    className
}: RunnableEndpointProps) {
    console.log("[RunnableEndpoint] Rendering component", {
        hasEndpoint: !!endpointDefinition,
        endpointMethod: endpointDefinition?.method,
        endpointPath: endpointDefinition?.path.map((p) => (p.type === "literal" ? p.value : `:${p.value}`)).join(""),
        typesCount: Object.keys(types ?? {}).length,
        globalHeadersCount: globalHeaders?.length ?? 0,
        example
    });
    if (endpointDefinition == null) {
        console.warn("[RunnableEndpoint] No endpoint definition provided");
        return null;
    }

    return (
        <RunnableEndpointInternal
            endpoint={endpointDefinition}
            types={types ?? {}}
            globalHeaders={globalHeaders ?? []}
            example={example}
            className={className}
        />
    );
}

function RunnableEndpointInternal({
    endpoint,
    types,
    globalHeaders,
    example,
    className
}: {
    endpoint: EndpointDefinition;
    types: Record<string, TypeDefinition>;
    globalHeaders: EndpointDefinition["requestHeaders"];
    example?: string;
    className?: string;
}) {
    const resolvedPlaygroundState = useResolvedPlaygroundState();

    // Create a minimal context for form state initialization
    const minimalContext = useMemo(
        () => ({
            endpoint,
            types,
            globalHeaders,
            auths: [] // No auth for now, can be added later
        }),
        [endpoint, types, globalHeaders]
    );

    // Find the example if specified
    const initialExampleIndex = useMemo(() => {
        if (!example || !endpoint.examples) {
            return 0;
        }
        const foundIndex = endpoint.examples.findIndex((ex) => ex.name === example);
        return foundIndex !== -1 ? foundIndex : 0;
    }, [endpoint.examples, example]);

    const [selectedExampleIndex, setSelectedExampleIndex] = useState<number>(initialExampleIndex);

    const initialFormState = useMemo(() => {
        const initialExample = endpoint.examples?.[initialExampleIndex];
        console.log("[RunnableEndpoint] Initializing form state", {
            hasSelectedExample: !!initialExample,
            exampleName: initialExample?.name
        });
        const baseFormState = getInitialEndpointRequestFormStateWithExample(
            minimalContext as any,
            initialExample,
            resolvedPlaygroundState
        );

        // Load saved values from localStorage
        try {
            const savedValues = localStorage.getItem("fern-runnable-endpoint-values");
            if (savedValues) {
                const parsed = JSON.parse(savedValues);
                // Merge saved values with base form state
                return {
                    ...baseFormState,
                    headers: { ...(baseFormState.headers ?? {}), ...(parsed.headers ?? {}) },
                    pathParameters: { ...(baseFormState.pathParameters ?? {}), ...(parsed.pathParameters ?? {}) },
                    queryParameters: { ...(baseFormState.queryParameters ?? {}), ...(parsed.queryParameters ?? {}) },
                    body:
                        parsed.body &&
                        baseFormState.body?.type === "json" &&
                        typeof baseFormState.body.value === "object" &&
                        baseFormState.body.value != null &&
                        typeof parsed.body === "object" &&
                        parsed.body != null
                            ? {
                                  type: "json" as const,
                                  value: { ...baseFormState.body.value, ...parsed.body }
                              }
                            : baseFormState.body
                };
            }
        } catch (error) {
            console.warn("[RunnableEndpoint] Failed to load saved values from localStorage", error);
        }

        return baseFormState;
    }, [endpoint.examples, initialExampleIndex, minimalContext, resolvedPlaygroundState]);

    const [formState, setFormState] = useState<PlaygroundEndpointRequestFormState>(initialFormState);

    // Save form values to localStorage whenever they change
    useEffect(() => {
        try {
            const valuesToSave = {
                headers: formState.headers ?? {},
                pathParameters: formState.pathParameters ?? {},
                queryParameters: formState.queryParameters ?? {},
                body: formState.body?.type === "json" ? formState.body.value : undefined
            };
            localStorage.setItem("fern-runnable-endpoint-values", JSON.stringify(valuesToSave));
        } catch (error) {
            console.warn("[RunnableEndpoint] Failed to save values to localStorage", error);
        }
    }, [formState]);

    // Update form state when example changes
    useEffect(() => {
        const example = endpoint.examples?.[selectedExampleIndex];
        console.log("[RunnableEndpoint] Updating form state for example", {
            selectedExampleIndex,
            hasExamples: !!endpoint.examples,
            examplesLength: endpoint.examples?.length ?? 0,
            example: example,
            exampleName: example?.name
        });

        if (example) {
            const baseFormState = getInitialEndpointRequestFormStateWithExample(
                minimalContext as any,
                example,
                resolvedPlaygroundState
            );

            // Merge with saved localStorage values
            try {
                const savedValues = localStorage.getItem("fern-runnable-endpoint-values");
                if (savedValues) {
                    const parsed = JSON.parse(savedValues);
                    const mergedFormState = {
                        ...baseFormState,
                        headers: { ...(baseFormState.headers ?? {}), ...(parsed.headers ?? {}) },
                        pathParameters: { ...(baseFormState.pathParameters ?? {}), ...(parsed.pathParameters ?? {}) },
                        queryParameters: {
                            ...(baseFormState.queryParameters ?? {}),
                            ...(parsed.queryParameters ?? {})
                        },
                        body:
                            parsed.body &&
                            baseFormState.body?.type === "json" &&
                            typeof baseFormState.body.value === "object" &&
                            baseFormState.body.value != null &&
                            typeof parsed.body === "object" &&
                            parsed.body != null
                                ? {
                                      type: "json" as const,
                                      value: { ...baseFormState.body.value, ...parsed.body }
                                  }
                                : baseFormState.body
                    };
                    console.log("[RunnableEndpoint] Merged form state with localStorage:", {
                        headers: Object.keys(mergedFormState.headers ?? {}),
                        pathParameters: Object.keys(mergedFormState.pathParameters ?? {}),
                        queryParameters: Object.keys(mergedFormState.queryParameters ?? {}),
                        hasBody: !!mergedFormState.body
                    });
                    setFormState(mergedFormState);
                    return;
                }
            } catch (error) {
                console.warn("[RunnableEndpoint] Failed to merge with localStorage", error);
            }

            console.log("[RunnableEndpoint] New form state:", {
                headers: Object.keys(baseFormState.headers ?? {}),
                pathParameters: Object.keys(baseFormState.pathParameters ?? {}),
                queryParameters: Object.keys(baseFormState.queryParameters ?? {}),
                hasBody: !!baseFormState.body
            });
            setFormState(baseFormState);
        }
    }, [selectedExampleIndex, endpoint.examples, minimalContext, resolvedPlaygroundState]);

    const [response, setResponse] = useState<Loadable<PlaygroundResponse>>(notStartedLoading());
    const [baseUrl, environmentId] = usePlaygroundBaseUrl(endpoint);
    const [responseExpanded, setResponseExpanded] = useState(true);
    const [formExpanded, setFormExpanded] = useState(true);

    console.log("[RunnableEndpoint] Component state", {
        baseUrl,
        environmentId,
        responseType: response.type,
        formStateType: formState.type
    });

    const sendRequest = useCallback(async () => {
        console.log("[RunnableEndpoint] Sending request", {
            method: endpoint.method,
            baseUrl,
            pathParameters: formState.pathParameters,
            queryParameters: formState.queryParameters,
            hasBody: !!formState.body
        });

        setResponse(loading());
        setResponseExpanded(true); // Auto-expand response on new request
        try {
            const authHeaders = buildAuthHeaders(
                undefined, // no auth context for now
                jotaiStore.get(PLAYGROUND_AUTH_STATE_ATOM),
                { redacted: false },
                {
                    formState,
                    endpoint,
                    baseUrl,
                    setValue: () => {
                        console.log("setValue that does nothing");
                    }
                }
            );

            const headers = {
                ...authHeaders,
                ...mapValues(formState.headers ?? {}, (value) => unknownToString(value))
            };

            if (endpoint.method !== "GET" && endpoint.requests?.[0]?.contentType != null) {
                headers["Content-Type"] = endpoint.requests[0].contentType;
            }

            const req: ProxyRequest = {
                url: buildEndpointUrl({
                    endpoint,
                    pathParameters: formState.pathParameters,
                    queryParameters: formState.queryParameters,
                    baseUrl
                }),
                method: endpoint.method,
                headers,
                body: await serializeFormStateBody({
                    shape: endpoint.requests?.[0]?.body,
                    body: formState.body,
                    protocol: endpoint.protocol
                })
            };

            console.log("[RunnableEndpoint] Request details", {
                url: req.url,
                method: req.method,
                headers: Object.keys(req.headers),
                bodyType: req.body?.type
            });
            const res = await executeProxyRest(req, isLocal());

            console.log("[RunnableEndpoint] Response received", {
                type: res.type,
                status: res.response.status,
                time: res.time
            });
            setResponse(loaded(res));
        } catch (e) {
            console.error("[RunnableEndpoint] Request failed:", e);
            setResponse(failed(e));
        }
    }, [endpoint, formState, baseUrl]);

    const setHeaders = useCallback(
        (value: ((old: unknown) => unknown) | unknown) => {
            setFormState((state) => ({
                ...state,
                headers: typeof value === "function" ? value(state.headers) : value
            }));
        },
        [setFormState]
    );

    const setPathParameters = useCallback(
        (value: ((old: unknown) => unknown) | unknown) => {
            setFormState((state) => ({
                ...state,
                pathParameters: typeof value === "function" ? value(state.pathParameters) : value
            }));
        },
        [setFormState]
    );

    const setQueryParameters = useCallback(
        (value: ((old: unknown) => unknown) | unknown) => {
            setFormState((state) => ({
                ...state,
                queryParameters: typeof value === "function" ? value(state.queryParameters) : value
            }));
        },
        [setFormState]
    );

    const setBodyJson = useCallback(
        (value: ((old: unknown) => unknown) | unknown) => {
            setFormState((state) => ({
                ...state,
                body: {
                    type: "json",
                    value:
                        typeof value === "function"
                            ? value(state.body?.type === "json" ? state.body.value : undefined)
                            : value
                }
            }));
        },
        [setFormState]
    );

    const allHeaders = useMemo(() => {
        return [...(globalHeaders ?? []), ...(endpoint.requestHeaders ?? [])];
    }, [endpoint.requestHeaders, globalHeaders]);

    const clearForm = useCallback(() => {
        // Clear localStorage
        try {
            localStorage.removeItem("fern-runnable-endpoint-values");
        } catch (error) {
            console.warn("[RunnableEndpoint] Failed to clear localStorage", error);
        }

        // Reset form to initial example state
        const example = endpoint.examples?.[selectedExampleIndex];
        const resetFormState = getInitialEndpointRequestFormStateWithExample(
            minimalContext as any,
            example,
            resolvedPlaygroundState
        );
        setFormState(resetFormState);

        // Clear response
        setResponse(notStartedLoading());
    }, [endpoint.examples, selectedExampleIndex, minimalContext, resolvedPlaygroundState]);

    const exampleOptions = useMemo(() => {
        if (!endpoint.examples || endpoint.examples.length === 0) {
            return [];
        }
        return endpoint.examples.map((ex, index) => ({
            type: "value" as const,
            label: ex.name || `Example ${index + 1}`,
            value: String(index)
        }));
    }, [endpoint.examples]);

    const hasMultipleExamples = exampleOptions.length > 1;

    const handleExampleChange = useCallback((value: string) => {
        const index = parseInt(value, 10);
        if (!isNaN(index)) {
            setSelectedExampleIndex(index);
        }
    }, []);

    return (
        <FernTooltipProvider>
            <div className={cn("my-6", className)}>
                {/* Card Container */}
                <FernCard className="rounded-3 flex flex-col overflow-hidden">
                    {/* Top Bar - Endpoint URL Header */}
                    <button
                        type="button"
                        onClick={() => setFormExpanded(!formExpanded)}
                        className="border-border-default flex w-full cursor-pointer items-center justify-between border-b bg-tag-default px-3 py-2 hover:bg-tag-default/50"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <ChevronDown
                                className={cn("size-4 shrink-0 transition-transform", {
                                    "-rotate-90": !formExpanded
                                })}
                            />
                            <div className="min-w-0 flex-1">
                                <EndpointUrlWithOverflow
                                    path={endpoint.path}
                                    method={endpoint.method}
                                    environmentId={environmentId}
                                    baseUrl={baseUrl}
                                    options={endpoint.environments}
                                    hideCopyButton={false}
                                />
                            </div>
                        </div>
                        {hasMultipleExamples && (
                            <div
                                className="flex shrink-0 items-center"
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <FernDropdown
                                    value={String(selectedExampleIndex)}
                                    options={exampleOptions}
                                    onValueChange={handleExampleChange}
                                >
                                    <FernButton
                                        text={
                                            exampleOptions.find((opt) => opt.value === String(selectedExampleIndex))
                                                ?.label ?? "Select Example"
                                        }
                                        rightIcon={<ChevronDown className="!size-icon" />}
                                        size="small"
                                        variant="outlined"
                                        mono={false}
                                    />
                                </FernDropdown>
                            </div>
                        )}
                    </button>

                    {/* Collapsible Form Section */}
                    <FernCollapse open={formExpanded}>
                        {/* Form Body */}
                        <div className="bg-card-background border-border-default border-b p-4">
                            <div className="space-y-4">
                                {/* Headers */}
                                {allHeaders != null && allHeaders.length > 0 && (
                                    <section>
                                        <h5 className="text-(color:--grayscale-a11) mb-2 text-sm font-medium">
                                            Headers
                                        </h5>
                                        <div className="bg-(color:--grayscale-a2) rounded-2 p-3">
                                            <PlaygroundObjectPropertiesForm
                                                id="header"
                                                properties={allHeaders.map((header) => ({
                                                    ...header,
                                                    key: PropertyKey(header.key)
                                                }))}
                                                extraProperties={undefined}
                                                onChange={setHeaders}
                                                value={formState?.headers}
                                                types={types}
                                            />
                                        </div>
                                    </section>
                                )}

                                {/* Path Parameters */}
                                {endpoint.pathParameters != null && endpoint.pathParameters.length > 0 && (
                                    <section>
                                        <h5 className="text-(color:--grayscale-a11) mb-2 text-sm font-medium">
                                            Path Parameters
                                        </h5>
                                        <div className="bg-(color:--grayscale-a2) rounded-2 p-3">
                                            <PlaygroundObjectPropertiesForm
                                                id="path"
                                                properties={endpoint.pathParameters}
                                                extraProperties={undefined}
                                                onChange={setPathParameters}
                                                value={formState?.pathParameters}
                                                types={types}
                                            />
                                        </div>
                                    </section>
                                )}

                                {/* Query Parameters */}
                                {endpoint.queryParameters != null && endpoint.queryParameters.length > 0 && (
                                    <section>
                                        <h5 className="text-(color:--grayscale-a11) mb-2 text-sm font-medium">
                                            Query Parameters
                                        </h5>
                                        <div className="bg-(color:--grayscale-a2) rounded-2 p-3">
                                            <PlaygroundObjectPropertiesForm
                                                id="query"
                                                properties={endpoint.queryParameters}
                                                extraProperties={undefined}
                                                onChange={setQueryParameters}
                                                value={formState?.queryParameters}
                                                types={types}
                                            />
                                        </div>
                                    </section>
                                )}

                                {/* Body Parameters */}
                                {endpoint.requests?.[0]?.body != null &&
                                    endpoint.requests[0].body.type === "object" && (
                                        <section>
                                            <h5 className="text-(color:--grayscale-a11) mb-2 text-sm font-medium">
                                                Body
                                            </h5>
                                            <div className="bg-(color:--grayscale-a2) rounded-2 p-3">
                                                <PlaygroundObjectPropertiesForm
                                                    id="body"
                                                    properties={endpoint.requests[0].body.properties ?? []}
                                                    extraProperties={endpoint.requests[0].body.extraProperties}
                                                    onChange={setBodyJson}
                                                    value={
                                                        formState?.body?.type === "json"
                                                            ? formState.body.value
                                                            : undefined
                                                    }
                                                    types={types}
                                                />
                                            </div>
                                        </section>
                                    )}
                            </div>
                        </div>

                        {/* Bottom Bar - Action Buttons */}
                        <div className="border-border-default bg-tag-default flex items-center justify-between border-b px-3 py-2">
                            <FernButton onClick={clearForm} variant="outlined" intent="none" className="group">
                                <span className="flex flex-row items-center">
                                    <RotateCcw className="mr-2 size-4 transition-transform group-hover:rotate-180" />
                                    Clear
                                </span>
                            </FernButton>

                            <FernButton
                                onClick={() => {
                                    void sendRequest();
                                }}
                                disabled={response.type === "loading"}
                                variant="filled"
                                intent="primary"
                                className="group overflow-visible"
                            >
                                <span className="flex flex-row items-center font-medium">
                                    {response.type === "loading" ? "Sending..." : "Send Request"}
                                    <SendHorizonal className="ml-2 mr-0.5 size-4 transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </FernButton>
                        </div>
                    </FernCollapse>

                    {/* Response Section */}
                    {response.type !== "notStartedLoading" && (
                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => setResponseExpanded(!responseExpanded)}
                                className="border-border-default flex h-10 w-full shrink-0 cursor-pointer items-center justify-between border-b px-3 py-2 hover:bg-tag-default/50"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronDown
                                        className={cn("size-4 transition-transform", {
                                            "-rotate-90": !responseExpanded
                                        })}
                                    />
                                    <span className="text-(color:--grayscale-a11) text-xs uppercase">Response</span>
                                </div>

                                {response.type === "loaded" && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span
                                            className={cn("rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono", {
                                                "bg-(color:--accent-a3) text-(color:--accent-a11)":
                                                    response.value.response.status >= 200 &&
                                                    response.value.response.status < 300,
                                                "bg-(color:--red-a3) text-(color:--red-a11)":
                                                    response.value.response.status >= 300
                                            })}
                                        >
                                            status: {response.value.response.status}
                                        </span>
                                        <span className="bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono">
                                            time: {round(response.value.time, 2)}ms
                                        </span>
                                        {response.value.type === "json" &&
                                            response.value.size != null &&
                                            response.value.size.trim().length > 0 && (
                                                <span className="bg-(color:--grayscale-a3) rounded-3/2 flex h-5 items-center px-1.5 py-1 font-mono">
                                                    size: {response.value.size}b
                                                </span>
                                            )}
                                        <CopyToClipboardButton
                                            content={() =>
                                                response.value.type === "json"
                                                    ? JSON.stringify(response.value.response.body, null, 2)
                                                    : response.value.type === "stream"
                                                      ? response.value.response.body
                                                      : typeof response.value.response.body === "string"
                                                        ? response.value.response.body
                                                        : ""
                                            }
                                            className="-mr-2"
                                        />
                                    </div>
                                )}

                                {response.type === "loading" && (
                                    <span className="text-(color:--grayscale-a11) text-xs">Loading...</span>
                                )}

                                {response.type === "failed" && (
                                    <span className="bg-(color:--red-a3) text-(color:--red-a11) rounded-1 flex items-center p-1 font-mono text-xs uppercase leading-none">
                                        Failed
                                    </span>
                                )}
                            </button>

                            <FernCollapse open={responseExpanded}>
                                {response.type === "loaded" && (
                                    <RunnableEndpointResponsePreview response={response.value} />
                                )}

                                {response.type === "failed" && (
                                    <div className="p-4">
                                        <div className="bg-(color:--red-a3) text-(color:--red-a11) rounded p-3 text-sm">
                                            <strong>Error:</strong> {String(response.error)}
                                        </div>
                                    </div>
                                )}
                            </FernCollapse>
                        </div>
                    )}
                </FernCard>
            </div>
        </FernTooltipProvider>
    );
}
