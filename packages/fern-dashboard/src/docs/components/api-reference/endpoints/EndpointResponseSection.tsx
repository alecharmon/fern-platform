"use client";

/**
 * Dashboard-specific adapter for the shared EndpointResponseSection component.
 *
 * Wraps @fern-docs/components/api-reference/endpoints/EndpointResponseSection
 * with dashboard-specific TypeReferenceDefinitions that uses local MdxContent.
 */

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import {
    EndpointResponseSection as SharedEndpointResponseSection,
    type TypeReferenceDefinitionsProps
} from "@fern-docs/components/api-reference/endpoints/EndpointResponseSection";

import { TypeReferenceDefinitions as LocalTypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export interface EndpointResponseSectionProps {
    body: ApiDefinition.HttpResponseBodyShape;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

/**
 * Dashboard-specific TypeReferenceDefinitions adapter.
 */
function TypeReferenceDefinitions({ shape, types, location }: TypeReferenceDefinitionsProps) {
    return <LocalTypeReferenceDefinitions shape={shape} types={types} location={location} />;
}

export function EndpointResponseSection({ body, types }: EndpointResponseSectionProps) {
    return (
        <SharedEndpointResponseSection
            body={body}
            types={types}
            lang="en"
            TypeReferenceDefinitions={TypeReferenceDefinitions}
        />
    );
}
