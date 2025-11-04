import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { t } from "@fern-docs/i18n";
import { compact } from "es-toolkit/array";
import type { ReactNode } from "react";

import { renderTypeShorthand } from "../../type-shorthand";
import { PropertyRenderer, PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeDefinitionAnchorPart } from "../type-definitions/TypeDefinitionContext";
import { WithSeparator } from "../type-definitions/TypeDefinitionDetails";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export function EndpointRequestSection({
    request,
    types,
    lang
}: {
    request: ApiDefinition.HttpRequest;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang: string;
}) {
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
                                    typeShorthand={renderTypeShorthandFormDataField(file, lang)}
                                    availability={file.availability}
                                />
                            </TypeDefinitionAnchorPart>
                        ),
                        files: (files) => (
                            <TypeDefinitionAnchorPart part={files.key} key={files.key}>
                                <PropertyRenderer
                                    name={files.key}
                                    description={files.description}
                                    typeShorthand={renderTypeShorthandFormDataField(files, lang)}
                                    availability={files.availability}
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
                                    lang={lang}
                                />
                            </TypeDefinitionAnchorPart>
                        ),
                        _other: () => null
                    })
                )}
            </WithSeparator>
        ),
        bytes: () => null,
        object: (obj) => <TypeReferenceDefinitions shape={obj} types={types} location="request" lang={lang} />,
        alias: (obj) => <TypeReferenceDefinitions shape={obj} types={types} location="request" lang={lang} />
    });
}

export function createEndpointRequestDescriptionFallback(
    request: ApiDefinition.HttpRequest,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    lang: string
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
    property: Exclude<ApiDefinition.FormDataField, ApiDefinition.FormDataField.Property>,
    lang: string
): ReactNode {
    return (
        <span className="fern-api-property-meta">
            <span>{property.type}</span>
            {property.isOptional ? (
                <span>{t(lang).playground.optional}</span>
            ) : (
                <span className="text-(color:--red-a11)">{t(lang).playground.required}</span>
            )}
        </span>
    );
}
