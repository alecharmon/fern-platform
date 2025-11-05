"use client";

import { type TypeDefinition, type TypeShape, unwrapObjectType } from "@fern-api/fdr-sdk/api-definition";
import { type ReactElement, useMemo } from "react";

import { PlaygroundObjectPropertiesForm } from "./PlaygroundObjectPropertyForm";

interface PlaygroundObjectFormProps {
    id: string;
    shape: TypeShape.Object_;
    onChange: (value: unknown) => void;
    value: unknown;
    indent?: boolean;
    types: Record<string, TypeDefinition>;
    defaultValue?: unknown;
    lang: string;
}

export function PlaygroundObjectForm({
    id,
    shape,
    onChange,
    value,
    types,
    lang
}: PlaygroundObjectFormProps): ReactElement<any> {
    const { properties, extraProperties } = useMemo(() => unwrapObjectType(shape, types), [shape, types]);
    return (
        <PlaygroundObjectPropertiesForm
            id={id}
            properties={properties}
            extraProperties={extraProperties}
            onChange={onChange}
            value={value}
            types={types}
            lang={lang}
        />
    );
}
