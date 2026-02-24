"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import { renderTypeShorthand } from "../../type-shorthand";
import { useEndpointContext } from "./EndpointContext";

export function ResponseSummaryFallback({
    response,
    types,
    lang
}: {
    response: ApiDefinition.HttpResponse;
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
}) {
    const { selectedExample } = useEndpointContext();
    const exampleResponseBody = selectedExample?.exampleCall.responseBody ?? undefined;

    return getResponseSummary({
        response,
        exampleResponseBody,
        types,
        isAudioFileDownloadSpanSummary: false,
        lang
    });
}

function getResponseSummary({
    response,
    exampleResponseBody,
    types,
    isAudioFileDownloadSpanSummary,
    lang
}: {
    response: ApiDefinition.HttpResponse;
    exampleResponseBody: ApiDefinition.ExampleEndpointResponse | undefined;
    types: Record<string, ApiDefinition.TypeDefinition>;
    isAudioFileDownloadSpanSummary: boolean;
    lang: string;
}) {
    switch (response.body.type) {
        case "empty":
            return t(lang).responses.thisEndpointReturnsNothing;
        case "fileDownload": {
            if (isAudioFileDownloadSpanSummary) {
                return <span>{t(lang).responses.thisEndpointReturnsAudio}</span>;
            }
            return t(lang).responses.thisEndpointReturnsFile;
        }
        case "streamingText":
            return t(lang).responses.thisEndpointSendsTextResponses;
        case "stream":
            return `This endpoint returns a stream of ${exampleResponseBody?.type === "sse" ? "server sent events" : renderTypeShorthand(response.body.shape, { withArticle: false }, types)}.`;
        default:
            return `This endpoint returns ${renderTypeShorthand(response.body, { withArticle: true }, types)}.`;
    }
}
