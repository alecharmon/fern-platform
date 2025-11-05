"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { unwrapReference } from "@fern-api/fdr-sdk/api-definition";
import { t } from "@fern-docs/i18n";
import { type ReactElement, useMemo } from "react";

import { PlaygroundObjectForm } from "../form/PlaygroundObjectForm";
import { PlaygroundTypeReferenceForm } from "../form/PlaygroundTypeReferenceForm";
import { PlaygroundEndpointFormSection } from "./PlaygroundEndpointFormSection";

interface PlaygroundEndpointAliasFormProps {
    alias: ApiDefinition.HttpRequestBodyShape.Alias;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    ignoreHeaders: boolean;
    setBodyJson: (value: unknown) => void;
    value: unknown;
    lang: string;
}

export function PlaygroundEndpointAliasForm({
    alias,
    types,
    ignoreHeaders,
    setBodyJson,
    value,
    lang
}: PlaygroundEndpointAliasFormProps): ReactElement<any> {
    const { shape, isOptional } = useMemo(() => unwrapReference(alias.value, types), [alias.value, types]);

    if (shape.type === "object" && !isOptional) {
        return (
            <PlaygroundEndpointFormSection ignoreHeaders={ignoreHeaders} title={t(lang).apiReference.bodyParameters}>
                <PlaygroundObjectForm
                    id="body"
                    shape={shape}
                    onChange={setBodyJson}
                    value={value}
                    types={types}
                    lang={lang}
                />
            </PlaygroundEndpointFormSection>
        );
    }
    return (
        <PlaygroundEndpointFormSection
            ignoreHeaders={ignoreHeaders}
            title={isOptional ? t(lang).apiReference.optionalBody : t(lang).apiReference.body}
        >
            <PlaygroundTypeReferenceForm
                id="body"
                shape={shape}
                onChange={setBodyJson}
                value={value}
                types={types}
                lang={lang}
            />
        </PlaygroundEndpointFormSection>
    );
}
