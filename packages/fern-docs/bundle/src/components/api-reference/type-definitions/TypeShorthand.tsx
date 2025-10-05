"use client";

import type { TypeShapeOrReference } from "@fern-api/fdr-sdk/api-definition";

import { renderTypeShorthandRoot } from "@/components/type-shorthand";

import { useGrpcContext } from "../grpcs/GrpcContext";
import { useTypeDefinitionContext } from "./TypeDefinitionContext";

export function TypeShorthand({ shape }: { shape: TypeShapeOrReference }) {
    const { grpcEndpoint } = useGrpcContext() ?? {};
    const context = useTypeDefinitionContext();
    return renderTypeShorthandRoot({
        shape,
        types: context.types,
        isResponse: context.isResponse,
        hideAllModifiers: grpcEndpoint?.protocol?.type === "grpc"
    });
}
