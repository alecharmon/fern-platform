"use client";

import type { TypeShapeOrReference } from "@fern-api/fdr-sdk/api-definition";

import { renderTypeShorthandRoot } from "@/docs/components/type-shorthand";

import { useTypeDefinitionContext } from "./TypeDefinitionContext";

export function TypeShorthand({ shape }: { shape: TypeShapeOrReference }) {
    const context = useTypeDefinitionContext();
    return renderTypeShorthandRoot({
        shape,
        types: context.types,
        isResponse: context.isResponse
    });
}
