"use client";

import { EndpointRequestSection as SharedEndpointRequestSection } from "@fern-api/endpoint-snippet-dependencies";

import { Chip, ChipSizeProvider } from "@fern-docs/components/Chip";
import { renderTypeShorthand } from "@fern-docs/components/type-shorthand";
import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { TypeShorthand } from "../type-definitions/TypeShorthand";
import { PropertyContainer, TypeDefinitionAnchor } from "./TypeDefinitionAnchor";

// Re-export all types from the shared package
export * from "@fern-api/endpoint-snippet-dependencies";

export interface EndpointRequestSectionProps {
    request: Parameters<typeof SharedEndpointRequestSection>[0]["request"];
    types: Parameters<typeof SharedEndpointRequestSection>[0]["types"];
}

export function EndpointRequestSection({ request, types }: EndpointRequestSectionProps) {
    return (
        <SharedEndpointRequestSection
            request={request}
            types={types}
            renderTypeShorthand={renderTypeShorthand}
            TypeShorthand={TypeShorthand}
            PropertyContainer={PropertyContainer}
            TypeDefinitionAnchor={TypeDefinitionAnchor}
            MdxRenderer={MdxContent}
            Chip={Chip}
            ChipSizeProvider={ChipSizeProvider}
        />
    );
}
