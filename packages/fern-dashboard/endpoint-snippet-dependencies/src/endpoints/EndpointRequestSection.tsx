/* eslint-disable unused-imports/no-unused-vars */
import { ReactNode } from "react";

import { compact } from "es-toolkit/array";

import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";

import { PropertyRenderer, PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { WithSeparator } from "../type-definitions/TypeDefinitionDetails";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export interface EndpointRequestSectionProps {
    request: ApiDefinition.HttpRequest;
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
    renderTypeShorthand: (
        shape: ApiDefinition.TypeShapeOrReference,
        options: { withArticle?: boolean },
        types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
    ) => string;
}

export function EndpointRequestSection({
    request,
    types,
    TypeShorthand,
    PropertyContainer,
    TypeDefinitionAnchor,
    MdxRenderer,
    Chip,
    ChipSizeProvider,
    renderTypeShorthand
}: EndpointRequestSectionProps) {
    return visitDiscriminatedUnion(request.body)._visit({
        formData: (formData) => (
            <WithSeparator>
                {formData.fields.map((p) =>
                    visitDiscriminatedUnion(p, "type")._visit({
                        file: (file) => (
                            <TypeDefinitionAnchorPart part={file.key} key={file.key}>
                                <PropertyRenderer
                                    name={file.key}
                                    description={file.description}
                                    typeShorthand={renderTypeShorthandFormDataField(file)}
                                    availability={file.availability}
                                    PropertyContainer={PropertyContainer}
                                    TypeDefinitionAnchor={TypeDefinitionAnchor}
                                    MdxRenderer={MdxRenderer}
                                />
                            </TypeDefinitionAnchorPart>
                        ),
                        files: (files) => (
                            <TypeDefinitionAnchorPart part={files.key} key={files.key}>
                                <PropertyRenderer
                                    name={files.key}
                                    description={files.description}
                                    typeShorthand={renderTypeShorthandFormDataField(files)}
                                    availability={files.availability}
                                    PropertyContainer={PropertyContainer}
                                    TypeDefinitionAnchor={TypeDefinitionAnchor}
                                    MdxRenderer={MdxRenderer}
                                />
                            </TypeDefinitionAnchorPart>
                        ),
                        property: (property) => (
                            <TypeDefinitionAnchorPart part={property.key} key={property.key}>
                                <PropertyWithShape
                                    name={property.key}
                                    description={
                                        compact([
                                            property.description,
                                            ...ApiDefinition.unwrapReference(property.valueShape, types).descriptions
                                        ])[0]
                                    }
                                    shape={property.valueShape}
                                    availability={property.availability}
                                    types={types}
                                    location="request"
                                    TypeShorthand={TypeShorthand}
                                    PropertyContainer={PropertyContainer}
                                    TypeDefinitionAnchor={TypeDefinitionAnchor}
                                    MdxRenderer={MdxRenderer}
                                    Chip={Chip}
                                    ChipSizeProvider={ChipSizeProvider}
                                />
                            </TypeDefinitionAnchorPart>
                        ),
                        _other: () => null
                    })
                )}
            </WithSeparator>
        ),
        bytes: () => null,
        object: (obj) => (
            <TypeReferenceDefinitions
                shape={obj}
                types={types}
                location="request"
                TypeShorthand={TypeShorthand}
                PropertyContainer={PropertyContainer}
                TypeDefinitionAnchor={TypeDefinitionAnchor}
                MdxRenderer={MdxRenderer}
                Chip={Chip}
                ChipSizeProvider={ChipSizeProvider}
            />
        ),
        alias: (obj) => (
            <TypeReferenceDefinitions
                shape={obj}
                types={types}
                location="request"
                TypeShorthand={TypeShorthand}
                PropertyContainer={PropertyContainer}
                TypeDefinitionAnchor={TypeDefinitionAnchor}
                MdxRenderer={MdxRenderer}
                Chip={Chip}
                ChipSizeProvider={ChipSizeProvider}
            />
        )
    });
}

export function createEndpointRequestDescriptionFallback(
    request: ApiDefinition.HttpRequest,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    renderTypeShorthand: (
        shape: ApiDefinition.TypeShapeOrReference,
        options: { withArticle?: boolean },
        types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
    ) => string
) {
    return `This endpoint expects ${visitDiscriminatedUnion(request.body)._visit<string>({
        formData: (formData) => {
            const fileArrays = formData.fields.filter(
                (p): p is ApiDefinition.FormDataField.Files => p.type === "files"
            );
            const files = formData.fields.filter((p): p is ApiDefinition.FormDataField.File_ => p.type === "file");
            return `a multipart form${fileArrays.length > 0 || files.length > 1 ? " with multiple files" : files[0] != null ? ` containing ${files[0].isOptional ? "an optional" : "a"} file` : ""}`;
        },
        bytes: (bytes) => `binary data${bytes.contentType != null ? ` of type ${bytes.contentType}` : ""}`,
        object: (obj) => renderTypeShorthand(obj, { withArticle: true }, types),
        alias: (alias) => renderTypeShorthand(alias, { withArticle: true }, types)
    })}.`;
}

function renderTypeShorthandFormDataField(
    property: Exclude<ApiDefinition.FormDataField, ApiDefinition.FormDataField.Property>
): ReactNode {
    return (
        <span className="fern-api-property-meta">
            <span>{property.type}</span>
            {property.isOptional ? <span>Optional</span> : <span className="text-(color:--red-a11)">Required</span>}
        </span>
    );
}
