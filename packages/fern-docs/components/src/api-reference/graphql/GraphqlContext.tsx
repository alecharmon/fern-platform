"use client";

import type { GraphQlOperation } from "@fern-api/fdr-sdk/api-definition";
import React from "react";

export const GraphqlContext = React.createContext<{
    example:
        | {
              query: string;
              variables: Record<string, unknown> | undefined;
              response: unknown;
          }
        | undefined;
    operation: GraphQlOperation | undefined;
}>({
    example: undefined,
    operation: undefined
});

export function GraphqlContextProvider({
    children,
    operation,
    example
}: {
    children: React.ReactNode;
    operation: GraphQlOperation;
    example?: {
        query: string;
        variables: Record<string, unknown> | undefined;
        response: unknown;
    };
}) {
    const value = React.useMemo(
        () => ({
            example,
            operation
        }),
        [example, operation]
    );

    return <GraphqlContext.Provider value={value}>{children}</GraphqlContext.Provider>;
}

export function useGraphqlContext() {
    return React.useContext(GraphqlContext);
}
