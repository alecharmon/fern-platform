"use client";

import { EndpointResponseSection as SharedEndpointResponseSection } from "@fern-api/endpoint-snippet-dependencies";

import { Chip, ChipSizeProvider } from "@/docs/components/Chip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { TypeShorthand } from "../type-definitions/TypeShorthand";
import {
  PropertyContainer,
  TypeDefinitionAnchor,
} from "./TypeDefinitionAnchor";

// Re-export all types from the shared package
export * from "@fern-api/endpoint-snippet-dependencies";

export interface EndpointResponseSectionProps {
  body: Parameters<typeof SharedEndpointResponseSection>[0]["body"];
  types: Parameters<typeof SharedEndpointResponseSection>[0]["types"];
}

export function EndpointResponseSection({
  body,
  types,
}: EndpointResponseSectionProps) {
  return (
    <SharedEndpointResponseSection
      body={body}
      types={types}
      TypeShorthand={TypeShorthand}
      PropertyContainer={PropertyContainer}
      TypeDefinitionAnchor={TypeDefinitionAnchor}
      MdxRenderer={MdxContent}
      Chip={Chip}
      ChipSizeProvider={ChipSizeProvider}
    />
  );
}
