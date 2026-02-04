"use client";

import type { ObjectPropertyAccess, TypeShapeOrReference } from "@fern-api/fdr-sdk/api-definition";

import { renderTypeShorthandRoot } from "../../type-shorthand";

import { useGrpcContext } from "../grpcs/GrpcContext";
import { useTypeDefinitionContext } from "./TypeDefinitionContext";

export function TypeShorthand({
    shape,
    lang,
    isGraphQL = false,
    propertyAccess
}: {
    shape: TypeShapeOrReference;
    lang: string;
    isGraphQL?: boolean;
    propertyAccess?: ObjectPropertyAccess;
}) {
    const { grpcEndpoint } = useGrpcContext() ?? {};
    const context = useTypeDefinitionContext();
    return renderTypeShorthandRoot({
        shape,
        types: context.types,
        isResponse: context.isResponse,
        hideAllModifiers: grpcEndpoint?.protocol?.type === "grpc",
        isGraphQL,
        lang,
        propertyAccess
    });
}
