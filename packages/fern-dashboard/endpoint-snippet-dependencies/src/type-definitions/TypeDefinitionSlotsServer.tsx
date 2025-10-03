// import "server-only";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import { TypeDefinitionSlotsProvider } from "./TypeDefinitionSlotsClient";
import {
  PropertyLocation,
  TypeReferenceDefinitions,
  TypeReferenceDefinitionsProps,
} from "./TypeReferenceDefinitions";

export interface TypeDefinitionSlotsServerProps {
  types: Record<string, ApiDefinition.TypeDefinition>;
  children: React.ReactNode;
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

export function TypeDefinitionSlotsServer({
  types,
  children,
  TypeShorthand,
  PropertyContainer,
  TypeDefinitionAnchor,
  MdxRenderer,
  Chip,
  ChipSizeProvider,
}: TypeDefinitionSlotsServerProps) {
  return (
    <TypeDefinitionSlotsProvider
      slots={createTypeDefinitionSlots(types, {
        TypeShorthand,
        PropertyContainer,
        TypeDefinitionAnchor,
        MdxRenderer,
        Chip,
        ChipSizeProvider,
      })}
    >
      {children}
    </TypeDefinitionSlotsProvider>
  );
}

function createTypeDefinitionSlots(
  types: Record<string, ApiDefinition.TypeDefinition>,
  componentProps: Omit<
    TypeReferenceDefinitionsProps,
    "shape" | "types" | "location" | "additionalProperties"
  >
) {
  return Object.fromEntries(
    Object.entries(types).flatMap(([id, type]) => {
      const variants = createPropertyAccessTypeVariants(
        id,
        type,
        types,
        componentProps
      );
      return [
        [id, variants.default],
        [getTypeIdWithLocation(id, "request"), variants.request],
        [getTypeIdWithLocation(id, "response"), variants.response],
      ];
    })
  );
}

function createPropertyAccessTypeVariants(
  id: string,
  type: ApiDefinition.TypeDefinition,
  types: Record<string, ApiDefinition.TypeDefinition>,
  componentProps: Omit<
    TypeReferenceDefinitionsProps,
    "shape" | "types" | "location" | "additionalProperties"
  >
) {
  return {
    default: (
      <TypeReferenceDefinitions
        shape={type.shape}
        types={types}
        {...componentProps}
      />
    ),
    request: (
      <TypeReferenceDefinitions
        shape={type.shape}
        types={types}
        location="request"
        {...componentProps}
      />
    ),
    response: (
      <TypeReferenceDefinitions
        shape={type.shape}
        types={types}
        location="response"
        {...componentProps}
      />
    ),
  };
}

export function getTypeIdWithLocation(id: string, location: PropertyLocation) {
  return `${id}_location:${location}`;
}
