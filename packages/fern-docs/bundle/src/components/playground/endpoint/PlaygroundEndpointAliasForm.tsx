"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { unwrapReference } from "@fern-api/fdr-sdk/api-definition";
import { type ReactElement, useMemo } from "react";

import { I18N } from "@/constants";

import { PlaygroundObjectForm } from "../form/PlaygroundObjectForm";
import { PlaygroundTypeReferenceForm } from "../form/PlaygroundTypeReferenceForm";
import { PlaygroundEndpointFormSection } from "./PlaygroundEndpointFormSection";

interface PlaygroundEndpointAliasFormProps {
    alias: ApiDefinition.HttpRequestBodyShape.Alias;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    ignoreHeaders: boolean;
    setBodyJson: (value: unknown) => void;
    value: unknown;
}

export function PlaygroundEndpointAliasForm({
    alias,
    types,
    ignoreHeaders,
    setBodyJson,
    value
}: PlaygroundEndpointAliasFormProps): ReactElement<any> {
    const { shape, isOptional } = useMemo(() => unwrapReference(alias.value, types), [alias.value, types]);

    if (shape.type === "object" && !isOptional) {
        return (
            <PlaygroundEndpointFormSection ignoreHeaders={ignoreHeaders} title={I18N.apiReference.bodyParameters}>
                <PlaygroundObjectForm id="body" shape={shape} onChange={setBodyJson} value={value} types={types} />
            </PlaygroundEndpointFormSection>
        );
    }
    return (
        <PlaygroundEndpointFormSection
            ignoreHeaders={ignoreHeaders}
            title={isOptional ? I18N.apiReference.optionalBody : I18N.apiReference.body}
        >
            <PlaygroundTypeReferenceForm id="body" shape={shape} onChange={setBodyJson} value={value} types={types} />
        </PlaygroundEndpointFormSection>
    );
}
