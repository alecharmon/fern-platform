import React from "react";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export function EndpointResponseSection({
    body,
    types
}: {
    body: ApiDefinition.HttpResponseBodyShape;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}) {
    switch (body.type) {
        case "empty":
        case "fileDownload":
        case "streamingText":
            return null;
        case "stream":
            return <TypeReferenceDefinitions shape={body.shape} types={types} location="response" />;
        default:
            return <TypeReferenceDefinitions shape={body} types={types} location="response" />;
    }
}
