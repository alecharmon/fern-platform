"use client";

import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { HttpRequest } from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import type { ReactNode } from "react";
import { useCallback } from "react";

import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { useEndpointContext } from "./EndpointContext";
import {
    EndpointRequestSection,
    type PropertyRendererProps,
    type PropertyWithShapeProps,
    type TypeReferenceDefinitionsProps
} from "./EndpointRequestSection";
import { EndpointSection } from "./EndpointSection";

export interface EndpointMultipleRequestSectionProps {
    requests: HttpRequest[];
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
    className?: string;
    renderedDescriptions: Record<string, ReactNode>;
    renderedFieldDescriptions: Record<string, Record<string, ReactNode>>;
    PropertyRenderer: React.ComponentType<PropertyRendererProps>;
    PropertyWithShape: React.ComponentType<PropertyWithShapeProps>;
    TypeReferenceDefinitions: React.ComponentType<TypeReferenceDefinitionsProps>;
}

export function EndpointMultipleRequestSection({
    requests,
    types,
    lang,
    className,
    renderedDescriptions,
    renderedFieldDescriptions,
    PropertyRenderer,
    PropertyWithShape,
    TypeReferenceDefinitions
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
            <TypeDefinitionAnchorPart part="body">
                <EndpointRequestSection
                    request={selectedRequest}
                    types={types}
                    lang={lang}
                    renderedFieldDescriptions={renderedFieldDescriptions[descriptionKey]}
                    PropertyRenderer={PropertyRenderer}
                    PropertyWithShape={PropertyWithShape}
                    TypeReferenceDefinitions={TypeReferenceDefinitions}
                />
            </TypeDefinitionAnchorPart>
        </EndpointSection>
    );
}
