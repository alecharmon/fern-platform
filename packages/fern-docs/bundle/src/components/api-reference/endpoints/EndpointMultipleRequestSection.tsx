"use client";

import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { HttpRequest } from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import { useCallback } from "react";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { useEndpointContext } from "./EndpointContext";
import { createEndpointRequestDescriptionFallback, EndpointRequestSection } from "./EndpointRequestSection";
import { EndpointSection } from "./EndpointSection";

export interface EndpointMultipleRequestSectionProps {
    requests: HttpRequest[];
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
}

export function EndpointMultipleRequestSection({ requests, types, lang }: EndpointMultipleRequestSectionProps) {
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

    return (
        <EndpointSection
            title={t(lang).apiReference.request}
            description={
                <MdxServerComponentProseSuspense
                    size="sm"
                    className="text-(color:--grayscale-a11)"
                    mdx={selectedRequest.description}
                    fallback={createEndpointRequestDescriptionFallback(selectedRequest, types, lang)}
                />
            }
            multipleRequestsProps={{
                requests,
                selectedRequest,
                setSelectedRequest,
                getRequestId
            }}
        >
            <TypeDefinitionAnchorPart part="body">
                <EndpointRequestSection request={selectedRequest} types={types} lang={lang} />
            </TypeDefinitionAnchorPart>
        </EndpointSection>
    );
}
