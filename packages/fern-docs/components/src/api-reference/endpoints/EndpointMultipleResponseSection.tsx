"use client";

import { ApiDefinition } from "@fern-api/fdr-sdk";
import type { HttpResponse } from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import type { ReactNode } from "react";
import { useCallback } from "react";

import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { useEndpointContext } from "./EndpointContext";
import { EndpointSection } from "./EndpointSection";
import { renderResponseTitle } from "./render-response-title";

export interface EndpointMultipleResponseSectionProps {
    method: ApiDefinition.HttpMethod;
    responses: HttpResponse[];
    lang: string;
    className?: string;
    /**
     * Pre-rendered descriptions keyed by statusCode.
     */
    renderedDescriptions: Record<number, ReactNode>;
    /**
     * Pre-rendered response bodies keyed by statusCode.
     */
    renderedBodies: Record<number, ReactNode>;
}

export function EndpointMultipleResponseSection({
    method,
    responses,
    lang,
    className,
    renderedDescriptions,
    renderedBodies
}: EndpointMultipleResponseSectionProps) {
    const { selectedResponse, setSelectedResponse, setSelectedExampleKey } = useEndpointContext();

    const getResponseId = useCallback(
        (response: HttpResponse) => {
            const title =
                ApiDefinition.getMessageForStatus(response.statusCode, method) ?? t(lang).apiReference.response;

            return renderResponseTitle(title, response.statusCode, true, response.isWildcard);
        },
        [method, lang]
    );

    if (!selectedResponse) {
        return null;
    }

    return (
        <EndpointSection
            title={t(lang).apiReference.response}
            className={className}
            description={renderedDescriptions[selectedResponse.statusCode]}
            multipleResponsesProps={{
                responses,
                selectedResponse,
                setSelectedResponse,
                getResponseId,
                setSelectedExampleKey
            }}
        >
            <TypeDefinitionAnchorPart part="body">
                {renderedBodies[selectedResponse.statusCode]}
            </TypeDefinitionAnchorPart>
        </EndpointSection>
    );
}
