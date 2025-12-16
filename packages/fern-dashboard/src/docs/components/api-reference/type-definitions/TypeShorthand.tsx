"use client";

import type { TypeShapeOrReference } from "@fern-api/fdr-sdk/api-definition";

import { renderTypeShorthandRoot } from "@fern-docs/components/type-shorthand";

import { useTypeDefinitionContext } from "./TypeDefinitionContext";

export function TypeShorthand({ shape, lang = "en" }: { shape: TypeShapeOrReference; lang?: string }) {
    const context = useTypeDefinitionContext();
    return renderTypeShorthandRoot({
        shape,
        types: context.types,
        isResponse: context.isResponse,
        lang
    });
}
