"use client";

import { ApiDefinition } from "@fern-api/fdr-sdk";
import type { HttpResponse } from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import { useCallback } from "react";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { renderResponseTitle } from "./EndpointContentCodeSnippets";
import { useEndpointContext } from "./EndpointContext";
import { EndpointResponseSection } from "./EndpointResponseSection";
import { EndpointSection } from "./EndpointSection";
import { ResponseSummaryFallback } from "./response-summary-fallback";

export interface EndpointMultipleResponseSectionProps {
    method: ApiDefinition.HttpMethod;
    responses: HttpResponse[];
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
}

export function EndpointMultipleResponseSection({
    method,
    responses,
    types,
    lang
}: EndpointMultipleResponseSectionProps) {
    const { selectedResponse, setSelectedResponse, setSelectedExampleKey } = useEndpointContext();

    const getResponseId = useCallback(
        (response: HttpResponse) => {
            const title =
                ApiDefinition.getMessageForStatus(response.statusCode, method) ?? t(lang).apiReference.response;

            return renderResponseTitle(title, response.statusCode, true);
        },
        [method, lang]
    );

    if (!selectedResponse) {
        return null;
    }

    return (
        <EndpointSection
            title={t(lang).apiReference.response}
            description={
                <MdxServerComponentProseSuspense
                    size="sm"
                    className="text-(color:--grayscale-a11)"
                    mdx={selectedResponse.description}
                    fallback={<ResponseSummaryFallback response={selectedResponse} types={types} lang={lang} />}
                />
            }
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
