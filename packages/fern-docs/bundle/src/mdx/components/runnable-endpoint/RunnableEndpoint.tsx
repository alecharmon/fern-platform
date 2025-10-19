"use client";

import type { EndpointDefinition, TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { unwrapObjectType, unwrapReference } from "@fern-api/fdr-sdk/api-definition";
import { cn } from "@fern-docs/components/cn";
import { FernCard } from "@fern-docs/components/FernCard";
import { FernCollapse } from "@fern-docs/components/FernCollapse";
import { FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useCurrentVersionSlug } from "@fern-docs/components/state/navigation";
import { useCallback, useMemo, useState } from "react";
import { usePlaygroundBaseUrl } from "@/components/playground/utils/select-environment";
import { RunnableEndpointActions } from "./components/RunnableEndpointActions";
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
}

export function RunnableEndpoint({
    endpointDefinition,
    types,
    globalHeaders,
    example,
    endpointSlugs,
    className,
    readonly
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
            example={example}
            endpointSlug={endpointSlug}
            className={className}
            readonly={readonly}
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
    example,
    endpointSlug,
    className,
    readonly
}: {
    endpoint: EndpointDefinition;
    types: Record<string, TypeDefinition>;
    globalHeaders: EndpointDefinition["requestHeaders"];
    example?: string;
    endpointSlug?: string;
    className?: string;
    readonly?: string[];
}) {
    const [formExpanded, setFormExpanded] = useState(true);
    const [responseExpanded, setResponseExpanded] = useState(true);

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

    // Get base URL for the endpoint
    const [baseUrl, environmentId] = usePlaygroundBaseUrl(endpoint);

    // Use custom hook for sending requests
    const { response, sendRequest, clearResponse } = useSendRequest({
        endpoint,
        formState,
        baseUrl
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

    return (
        <FernTooltipProvider>
            <div className={cn("fern-runnable-endpoint my-6", className)}>
                <FernCard className="rounded-3 flex flex-col overflow-hidden">
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
                    />

                    {/* Collapsible Form Section */}
                    <FernCollapse open={formExpanded}>
                        <div className="bg-card-background border-border-default border-b p-4">
                            <div className="space-y-4">
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
                                    />
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <RunnableEndpointActions
                            onClear={handleClearForm}
                            onSend={handleSendRequest}
                            isSending={response.type === "loading"}
                        />
                    </FernCollapse>

                    {/* Response Section */}
                    <RunnableEndpointResponseSection
                        response={response}
                        isExpanded={responseExpanded}
                        onToggle={() => setResponseExpanded(!responseExpanded)}
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
