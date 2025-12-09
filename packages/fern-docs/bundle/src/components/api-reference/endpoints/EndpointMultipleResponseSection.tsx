"use client";

import { ApiDefinition } from "@fern-api/fdr-sdk";
import type { HttpResponse } from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import type { ReactNode } from "react";
import { useCallback } from "react";

import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { renderResponseTitle } from "./EndpointContentCodeSnippets";
import { useEndpointContext } from "./EndpointContext";
import { EndpointResponseSection } from "./EndpointResponseSection";
import { EndpointSection } from "./EndpointSection";

export interface EndpointMultipleResponseSectionProps {
    method: ApiDefinition.HttpMethod;
    responses: HttpResponse[];
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
    className?: string;
    renderedDescriptions: Record<number, ReactNode>;
}

export function EndpointMultipleResponseSection({
    method,
    responses,
    types,
    lang,
    className,
    renderedDescriptions
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
                <EndpointResponseSection body={selectedResponse.body} types={types} lang={lang} />
            </TypeDefinitionAnchorPart>
        </EndpointSection>
    );
}
