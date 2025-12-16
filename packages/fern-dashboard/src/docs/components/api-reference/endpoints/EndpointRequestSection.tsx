"use client";

/**
 * Dashboard-specific wrapper for the shared EndpointRequestSection component.
 *
 * Passes dashboard's local PropertyRenderer, PropertyWithShape, and TypeReferenceDefinitions
 * which handle MDX rendering via MdxContent.
 */

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { EndpointRequestSection as SharedEndpointRequestSection } from "@fern-docs/components/api-reference/endpoints/EndpointRequestSection";

import { PropertyRenderer, PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export interface EndpointRequestSectionProps {
    request: ApiDefinition.HttpRequest;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function EndpointRequestSection({ request, types }: EndpointRequestSectionProps) {
    return (
        <SharedEndpointRequestSection
            request={request}
            types={types}
            lang="en"
            PropertyRenderer={PropertyRenderer}
            PropertyWithShape={PropertyWithShape}
            TypeReferenceDefinitions={TypeReferenceDefinitions}
        />
    );
}
