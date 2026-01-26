/**
 * Bundle-specific ObjectProperty with full MDX rendering support.
 *
 * This component renders descriptions with MDX via MdxServerComponentProseSuspense.
 * It uses local (bundle) TypeReferenceDefinitions to maintain the closed recursive loop
 * where all nested types also render descriptions with MDX.
 */
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import {
    PropertyContainer,
    TypeDefinitionAnchor
} from "@fern-docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import { PropertyKey } from "@fern-docs/components/api-reference/type-definitions/PropertyKey";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionCollapsible
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { TypeShorthand } from "@fern-docs/components/api-reference/type-definitions/TypeShorthand";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { compact } from "es-toolkit/array";
import React from "react";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type {
    ObjectPropertyWithSerializedDescription,
    SerializedDescription
} from "@/mdx/plugins/serialize-type-definition-descriptions";
import { SerializedMdxRenderer } from "./SerializedMdxRenderer";
import { type PropertyLocation, TypeReferenceDefinitions } from "./TypeReferenceDefinitions";

export const ObjectProperty = React.memo(function ObjectProperty({
    property,
    types,
    location,
    lang,
    badge,
    isGraphQL = false
}: {
    property: ApiDefinition.ObjectProperty | ObjectPropertyWithSerializedDescription;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    lang: string;
    badge?: React.ReactNode;
    isGraphQL?: boolean;
}) {
    const unwrapped = ApiDefinition.unwrapReference(property.valueShape, types);
    const description = compact([property.description, ...unwrapped.descriptions])[0];

    // Check if property has a serialized description
    const serializedDescription = (property as ObjectPropertyWithSerializedDescription).serializedDescription;

    return (
        <PropertyWithShape
            name={property.key}
            availability={property.availability}
            description={description}
            serializedDescription={serializedDescription}
            shape={property.valueShape}
            types={types}
            location={location}
            lang={lang}
            badge={badge}
            isGraphQL={isGraphQL}
        />
    );
});

export const PropertyWithShape = React.memo(function PropertyWithShape({
    name,
    description,
    serializedDescription,
    renderedDescription,
    shape,
    availability,
    types,
    location,
    additionalProperties,
    lang,
    badge,
    isGraphQL = false
}: {
    icon?: React.ReactNode;
    name?: string;
    description?: string | undefined;
    serializedDescription?: SerializedDescription;
    renderedDescription?: React.ReactNode;
    availability: ApiDefinition.Availability | null | undefined;
    shape: ApiDefinition.TypeShapeOrReference;
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang: string;
    badge?: React.ReactNode;
    isGraphQL?: boolean;
}) {
    return (
        <PropertyRenderer
            name={name}
            description={description}
            serializedDescription={serializedDescription}
            renderedDescription={renderedDescription}
            typeShorthand={<TypeShorthand shape={shape} lang={lang} isGraphQL={isGraphQL} />}
            availability={availability}
            badge={badge}
        >
            <TypeReferenceDefinitions
                shape={shape}
                types={types}
                location={location}
                additionalProperties={additionalProperties}
                lang={lang}
                isGraphQL={isGraphQL}
            />
        </PropertyRenderer>
    );
});

export const PropertyRenderer = React.memo(function PropertyRenderer({
    icon,
    name,
    availability,
    description,
    serializedDescription,
    renderedDescription,
    typeShorthand,
    children,
    badge
}: {
    icon?: React.ReactNode;
    name?: string;
    description?: string | undefined;
    serializedDescription?: SerializedDescription;
    renderedDescription?: React.ReactNode;
    typeShorthand: React.ReactNode;
    availability: ApiDefinition.Availability | null | undefined;
    children?: React.ReactNode;
    badge?: React.ReactNode;
}) {
    // Determine what to render for description
    let descriptionContent: React.ReactNode = null;
    if (renderedDescription) {
        descriptionContent = renderedDescription;
    } else if (serializedDescription) {
        // Use pre-serialized description (from Schema component in MDX)
        descriptionContent = (
            <SerializedMdxRenderer
                serializedDescription={serializedDescription}
                fallback={description}
                size="sm"
                className="text-(color:--grayscale-a11)"
            />
        );
    } else {
        // Use server-side serialization (for API reference pages)
        descriptionContent = (
            <MdxServerComponentProseSuspense mdx={description} size="sm" className="text-(color:--grayscale-a11)" />
        );
    }

    const child = (
        <PropertyContainer>
            <TypeDefinitionAnchor sideOffset={6}>
                {icon}
                {badge}
                {name != null && <PropertyKey className="fern-api-property-key">{name}</PropertyKey>}
                {typeShorthand}
                {availability != null && <AvailabilityBadge availability={availability} size="sm" rounded />}
            </TypeDefinitionAnchor>

            {descriptionContent}

            <TypeDefinitionCollapsible>{children}</TypeDefinitionCollapsible>
        </PropertyContainer>
    );

    if (name != null) {
        return <TypeDefinitionAnchorPart part={name}>{child}</TypeDefinitionAnchorPart>;
    }

    return child;
});
