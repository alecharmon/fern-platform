"use client";

import { ObjectProperty as SharedObjectProperty } from "@fern-api/endpoint-snippet-dependencies";

import { Chip, ChipSizeProvider } from "@/docs/components/Chip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { PropertyContainer, TypeDefinitionAnchor } from "../endpoints/TypeDefinitionAnchor";
import { TypeShorthand } from "./TypeShorthand";

// Re-export all types from the shared package
export * from "@fern-api/endpoint-snippet-dependencies";

export interface ObjectPropertyProps {
    property: Parameters<typeof SharedObjectProperty>[0]["property"];
    types: Parameters<typeof SharedObjectProperty>[0]["types"];
    location?: Parameters<typeof SharedObjectProperty>[0]["location"];
}

export function ObjectProperty({ property, types, location }: ObjectPropertyProps) {
    return (
        <SharedObjectProperty
            property={property}
            types={types}
            location={location}
            TypeShorthand={TypeShorthand}
            PropertyContainer={PropertyContainer}
            TypeDefinitionAnchor={TypeDefinitionAnchor}
            MdxRenderer={MdxContent}
            Chip={Chip}
            ChipSizeProvider={ChipSizeProvider}
        />
    );
}
