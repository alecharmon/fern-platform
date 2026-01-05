"use client";

import type { AuthScheme, EndpointDefinition, EnvironmentId, TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { unwrapObjectType, unwrapReference } from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components/cn";
import { FernCard } from "@fern-docs/components/FernCard";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useCurrentVersionSlug } from "@fern-docs/components/state/navigation";
import { useCallback, useMemo, useState } from "react";
import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";
import { RunnableEndpointActions } from "./components/RunnableEndpointActions";
import { RunnableEndpointAuthSection } from "./components/RunnableEndpointAuthSection";
import { RunnableEndpointFormSection } from "./components/RunnableEndpointFormSection";
import { RunnableEndpointHeader } from "./components/RunnableEndpointHeader";
import { RunnableEndpointResponseSection } from "./components/RunnableEndpointResponseSection";
import { useRunnableEndpointForm } from "./hooks/useRunnableEndpointForm";
import { useSendRequest } from "./hooks/useSendRequest";

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
     * @internal the rehype-runnable-endpoint plugin will set this
     */
    authSchemes?: AuthScheme[];

    /**
     * @internal the rehype-runnable-endpoint plugin will set this
     */
    endpointSlugs?: string[];

    /**
     * Optional className for styling
     */
    className?: string;

    /**
     * Field keys that should be read-only.
     * These fields will display their example values but users cannot modify them.
     */
    readonly?: string[];

    /**
     * @internal Whether to disable the proxy.
     */
    disableProxy?: boolean;

    /**
     * @internal the rehype-runnable-endpoint plugin will set this
     */
    lang?: string;

    /**
     * Optional default environment ID to use instead of the one specified in the API configuration.
     * This allows overriding the default environment on a per-endpoint basis.
     */
    defaultEnvironment?: string;

    /**
     * Whether the component should be collapsed by default.
     * When true, the form section will be hidden initially.
     */
    collapsed?: boolean;
}

export function RunnableEndpoint({
    endpointDefinition,
    types,
    globalHeaders,
    authSchemes,
    example,
    endpointSlugs,
    className,
    readonly,
    disableProxy,
    lang,
    defaultEnvironment,
    collapsed
}: RunnableEndpointProps) {
    const endpointSlug = useCurrentSlug(endpointSlugs);

    if (endpointDefinition == null) {
        return null;
    }

    return (
        <RunnableEndpointInternal
            endpoint={endpointDefinition}
            types={types ?? {}}
            globalHeaders={globalHeaders ?? []}
            authSchemes={authSchemes ?? []}
            example={example}
            endpointSlug={endpointSlug}
            className={className}
            readonly={readonly}
            disableProxy={disableProxy}
            lang={lang ?? "en"}
            defaultEnvironment={defaultEnvironment}
            collapsed={collapsed}
        />
    );
}

function getUnwrappedBodyObject(
    requestBody: NonNullable<EndpointDefinition["requests"]>[number]["body"],
    types: Record<string, TypeDefinition>
) {
    if (requestBody.type === "alias") {
        const unwrappedBody = unwrapReference(requestBody.value, types);
        if (unwrappedBody?.shape.type === "object") {
            return unwrapObjectType(unwrappedBody.shape, types);
        }
    } else if (requestBody.type === "object") {
        return unwrapObjectType(requestBody, types);
    }
    return null;
}

function RunnableEndpointInternal({
    endpoint,
    types,
    globalHeaders,
    authSchemes,
    example,
    endpointSlug,
    className,
    readonly,
    disableProxy,
    lang,
    defaultEnvironment,
    collapsed
}: {
    endpoint: EndpointDefinition;
    types: Record<string, TypeDefinition>;
    globalHeaders: EndpointDefinition["requestHeaders"];
    authSchemes: AuthScheme[];
    example?: string;
    endpointSlug?: string;
    className?: string;
    readonly?: string[];
    disableProxy?: boolean;
    lang: string;
    defaultEnvironment?: string;
    collapsed?: boolean;
}) {
    const [formExpanded, setFormExpanded] = useState(!collapsed);
    const [responseExpanded, setResponseExpanded] = useState(true);

    const endpointWithDefaultEnv = useMemo<EndpointDefinition>(() => {
        if (defaultEnvironment != null) {
            return {
                ...endpoint,
                defaultEnvironment: defaultEnvironment as EnvironmentId
            };
        }
        return endpoint;
    }, [endpoint, defaultEnvironment]);

    // Use custom hooks for form state management
    const {
        formState,
        selectedExampleIndex,
        exampleOptions,
        hasMultipleExamples,
        setHeaders,
        setPathParameters,
        setQueryParameters,
        setBodyJson,
        setSelectedExampleIndex,
        clearForm
    } = useRunnableEndpointForm({
        endpoint,
        types,
        globalHeaders,
        example
    });

    // Get base URL for the endpoint (using the endpoint with overridden defaultEnvironment)
    const [baseUrl, environmentId] = usePlaygroundBaseUrl(endpointWithDefaultEnv);

    // Use custom hook for sending requests
    const { response, sendRequest, clearResponse } = useSendRequest({
        endpoint,
        formState,
        baseUrl,
        authSchemes,
        disableProxy
    });

    // Combine all headers (global + endpoint-specific)
    const allHeaders = useMemo(() => {
        return [...(globalHeaders ?? []), ...(endpoint.requestHeaders ?? [])];
    }, [endpoint.requestHeaders, globalHeaders]);

    const requestBody = endpoint.requests?.[0]?.body;
    const unwrappedBodyObject = useMemo(() => {
        return requestBody ? getUnwrappedBodyObject(requestBody, types) : null;
    }, [requestBody, types]);

    // Handler for sending request
    const handleSendRequest = useCallback(() => {
        setResponseExpanded(true);
        void sendRequest();
    }, [sendRequest]);

    // Handler for clearing form
    const handleClearForm = useCallback(() => {
        clearForm();
        clearResponse();
    }, [clearForm, clearResponse]);

    // Handler for example change
    const handleExampleChange = useCallback(
        (value: string) => {
            const index = parseInt(value, 10);
            if (!isNaN(index)) {
                setSelectedExampleIndex(index);
            }
        },
        [setSelectedExampleIndex]
    );

    const hasProperties = useMemo(() => {
        return (
            Object.keys(formState.headers).length > 0 ||
            Object.keys(formState.pathParameters).length > 0 ||
            Object.keys(formState.queryParameters).length > 0 ||
            formState.body?.value != null ||
            authSchemes.length > 0
        );
    }, [formState, authSchemes]);

    return (
        <FernTooltipProvider>
            <div className={cn("fern-runnable-endpoint my-6", className)}>
                <FernCard className="fern-runnable-card rounded-3 flex flex-col overflow-hidden">
                    {/* Header with endpoint URL and example selector */}
                    <RunnableEndpointHeader
                        endpoint={endpoint}
                        environmentId={environmentId}
                        baseUrl={baseUrl}
                        formExpanded={formExpanded}
                        onToggleForm={() => setFormExpanded(!formExpanded)}
                        hasMultipleExamples={hasMultipleExamples}
                        exampleOptions={exampleOptions}
                        selectedExampleIndex={selectedExampleIndex}
                        onExampleChange={handleExampleChange}
                        endpointSlug={endpointSlug}
                        lang={lang}
                        readonly={readonly}
                    />

                    {/* Collapsible Form Section */}
                    <FernCollapse open={formExpanded}>
                        {hasProperties && (
                            <div className="fern-runnable-form bg-card-background border-border-default border-b p-4">
                                <div className="fern-runnable-form-inner space-y-4">
                                    {/* Authentication */}
                                    {authSchemes.length > 0 && (
                                        <RunnableEndpointAuthSection authSchemes={authSchemes} lang={lang} />
                                    )}

                                    {/* Headers */}
                                    <RunnableEndpointFormSection
                                        id="header"
                                        title="Headers"
                                        properties={allHeaders}
                                        extraProperties={undefined}
                                        value={formState.headers}
                                        onChange={setHeaders}
                                        types={types}
                                        readonly={readonly}
                                        lang={lang}
                                    />

                                    {/* Path Parameters */}
                                    <RunnableEndpointFormSection
                                        id="path"
                                        title="Path Parameters"
                                        properties={endpoint.pathParameters ?? []}
                                        extraProperties={undefined}
                                        value={formState.pathParameters}
                                        onChange={setPathParameters}
                                        types={types}
                                        readonly={readonly}
                                        lang={lang}
                                    />

                                    {/* Query Parameters */}
                                    <RunnableEndpointFormSection
                                        id="query"
                                        title="Query Parameters"
                                        properties={endpoint.queryParameters ?? []}
                                        extraProperties={undefined}
                                        value={formState.queryParameters}
                                        onChange={setQueryParameters}
                                        types={types}
                                        readonly={readonly}
                                        lang={lang}
                                    />

                                    {/* Body Parameters */}
                                    {unwrappedBodyObject && (
                                        <RunnableEndpointFormSection
                                            id="body"
                                            title="Body"
                                            properties={unwrappedBodyObject.properties}
                                            extraProperties={unwrappedBodyObject.extraProperties}
                                            value={formState.body?.type === "json" ? formState.body.value : undefined}
                                            onChange={setBodyJson}
                                            types={types}
                                            readonly={readonly}
                                            lang={lang}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <RunnableEndpointActions
                            onClear={handleClearForm}
                            onSend={handleSendRequest}
                            isSending={response.type === "loading"}
                            lang={lang}
                        />
                    </FernCollapse>

                    {/* Response Section */}
                    <RunnableEndpointResponseSection
                        response={response}
                        isExpanded={responseExpanded}
                        onToggle={() => setResponseExpanded(!responseExpanded)}
                        lang={lang}
                    />
                </FernCard>
            </div>
        </FernTooltipProvider>
    );
}

function useCurrentSlug(slugs: string[] | undefined): string | undefined {
    const currentVersionSlug = useCurrentVersionSlug();

    if (slugs == null) {
        return undefined;
    }

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
