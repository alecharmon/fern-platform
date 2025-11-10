import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { compact } from "es-toolkit/array";
import React from "react";

import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import { PropertyContainer, TypeDefinitionAnchor } from "../endpoints/TypeDefinitionAnchor";
import { PropertyKey } from "./PropertyKey";
import { TypeDefinitionAnchorPart, TypeDefinitionCollapsible } from "./TypeDefinitionContext";
import { type PropertyLocation, TypeReferenceDefinitions } from "./TypeReferenceDefinitions";
import { TypeShorthand } from "./TypeShorthand";

export const ObjectProperty = React.memo(function ObjectProperty({
    property,
    types,
    location,
    lang
}: {
    property: ApiDefinition.ObjectProperty;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    lang: string;
}) {
    const unwrapped = ApiDefinition.unwrapReference(property.valueShape, types);
    const description = compact([property.description, ...unwrapped.descriptions])[0];

    return (
        <PropertyWithShape
            name={property.key}
            availability={property.availability}
            description={description}
            shape={property.valueShape}
            types={types}
            location={location}
            lang={lang}
        />
    );
});

export const PropertyWithShape = React.memo(function PropertyWithShape({
    name,
    description,
    shape,
    availability,
    types,
    location,
    additionalProperties,
    lang
}: {
    icon?: React.ReactNode;
    name?: string;
    description: string | undefined;
    availability: ApiDefinition.Availability | null | undefined;
    shape: ApiDefinition.TypeShape;
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang: string;
}) {
    return (
        <PropertyRenderer
            name={name}
            description={description}
            typeShorthand={<TypeShorthand shape={shape} lang={lang} />}
            availability={availability}
        >
            <TypeReferenceDefinitions
                shape={shape}
                types={types}
                location={location}
                additionalProperties={additionalProperties}
                lang={lang}
            />
        </PropertyRenderer>
    );
});

export const PropertyRenderer = React.memo(function PropertyRenderer({
    icon,
    name,
    availability,
    description,
    typeShorthand,
    children
}: {
    icon?: React.ReactNode;
    name?: string;
    description: string | undefined;
    typeShorthand: React.ReactNode;
    availability: ApiDefinition.Availability | null | undefined;
    children?: React.ReactNode;
}) {
    const child = (
        <PropertyContainer>
            <TypeDefinitionAnchor sideOffset={6}>
                {icon}
                {name != null && <PropertyKey className="fern-api-property-key">{name}</PropertyKey>}
                {typeShorthand}
                {availability != null && <AvailabilityBadge availability={availability} size="sm" rounded />}
            </TypeDefinitionAnchor>

            <MdxServerComponentProseSuspense mdx={description} size="sm" className="text-(color:--grayscale-a11)" />

            <TypeDefinitionCollapsible>{children}</TypeDefinitionCollapsible>
        </PropertyContainer>
    );

    if (name != null) {
        return <TypeDefinitionAnchorPart part={name}>{child}</TypeDefinitionAnchorPart>;
    }

    return child;
});
