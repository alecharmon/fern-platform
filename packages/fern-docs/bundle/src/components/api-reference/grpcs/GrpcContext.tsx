"use client";

import React from "react";

import { EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";

export const GrpcContext = React.createContext<{
    example:
        | {
              request: unknown;
              response: unknown;
          }
        | undefined;
    grpcEndpoint: EndpointDefinition | undefined;
}>({
    example: undefined,
    grpcEndpoint: undefined
});

export function GrpcContextProvider({
    children,
    grpcEndpoint,
    example
}: {
    children: React.ReactNode;
    grpcEndpoint: EndpointDefinition;
    example?: {
        request: unknown;
        response: unknown;
    };
}) {
    const value = React.useMemo(
        () => ({
            example,
            grpcEndpoint
        }),
        [example, grpcEndpoint]
    );

    return <GrpcContext.Provider value={value}>{children}</GrpcContext.Provider>;
}

export function useGrpcContext() {
    return React.useContext(GrpcContext);
}
