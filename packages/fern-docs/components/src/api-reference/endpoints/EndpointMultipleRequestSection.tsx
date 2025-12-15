"use client";

import type { HttpRequest } from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import type { ReactNode } from "react";
import { useCallback } from "react";

import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { useEndpointContext } from "./EndpointContext";
import { EndpointSection } from "./EndpointSection";

export interface EndpointMultipleRequestSectionProps {
    requests: HttpRequest[];
    lang: string;
    className?: string;
    /**
     * Pre-rendered descriptions keyed by contentType (or "default").
     */
    renderedDescriptions: Record<string, ReactNode>;
    /**
     * Pre-rendered request bodies keyed by contentType (or "default").
     */
    renderedBodies: Record<string, ReactNode>;
}

export function EndpointMultipleRequestSection({
    requests,
    lang,
    className,
    renderedDescriptions,
    renderedBodies
}: EndpointMultipleRequestSectionProps) {
    const { selectedRequest, setSelectedRequest } = useEndpointContext();

    const getRequestId = useCallback(
        (request: HttpRequest) => {
            const contentType = request.contentType ?? t(lang).apiReference.request;
            return (
                <span className="inline-flex items-center gap-2">
                    <span className="text-intent-info">{contentType}</span>
                </span>
            );
        },
        [lang]
    );

    if (!selectedRequest) {
        return null;
    }

    const descriptionKey = selectedRequest.contentType ?? "default";

    return (
        <EndpointSection
            title={t(lang).apiReference.request}
            className={className}
            description={renderedDescriptions[descriptionKey]}
            multipleRequestsProps={{
                requests,
                selectedRequest,
                setSelectedRequest,
                getRequestId
            }}
        >
            <TypeDefinitionAnchorPart part="body">{renderedBodies[descriptionKey]}</TypeDefinitionAnchorPart>
        </EndpointSection>
    );
}
