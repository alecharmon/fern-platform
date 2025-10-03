import React from "react";

import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export interface EndpointResponseSectionProps {
  body: ApiDefinition.HttpResponseBodyShape;
  types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
  TypeShorthand: React.ComponentType<{
    shape: ApiDefinition.TypeShapeOrReference;
  }>;
  PropertyContainer: React.ComponentType<{ children: React.ReactNode }>;
  TypeDefinitionAnchor: React.ComponentType<{
    children: React.ReactNode;
    sideOffset?: number;
  }>;
  MdxRenderer?: React.ComponentType<{
    mdx: string | undefined;
    size?: string;
    className?: string;
  }>;
  Chip: React.ComponentType<{
    name: string;
    description?: React.ReactNode;
  }>;
  ChipSizeProvider: React.ComponentType<{
    children: React.ReactNode;
    size: "sm" | "lg";
  }>;
}

export function EndpointResponseSection({
  body,
  types,
  TypeShorthand,
  PropertyContainer,
  TypeDefinitionAnchor,
  MdxRenderer,
  Chip,
  ChipSizeProvider,
}: EndpointResponseSectionProps) {
  switch (body.type) {
    case "empty":
    case "fileDownload":
    case "streamingText":
      return null;
    case "stream":
      return (
        <TypeReferenceDefinitions
          shape={body.shape}
          types={types}
          location="response"
          TypeShorthand={TypeShorthand}
          PropertyContainer={PropertyContainer}
          TypeDefinitionAnchor={TypeDefinitionAnchor}
          MdxRenderer={MdxRenderer}
          Chip={Chip}
          ChipSizeProvider={ChipSizeProvider}
        />
      );
    default:
      return (
        <TypeReferenceDefinitions
          shape={body}
          types={types}
          location="response"
          TypeShorthand={TypeShorthand}
          PropertyContainer={PropertyContainer}
          TypeDefinitionAnchor={TypeDefinitionAnchor}
          MdxRenderer={MdxRenderer}
          Chip={Chip}
          ChipSizeProvider={ChipSizeProvider}
        />
      );
  }
}
