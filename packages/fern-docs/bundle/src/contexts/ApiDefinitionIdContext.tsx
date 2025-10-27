"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { createContext, type ReactNode, useContext } from "react";

const ApiDefinitionIdContext = createContext<FdrAPI.ApiDefinitionId | undefined>(undefined);

export function ApiDefinitionIdProvider({
    value,
    children
}: {
    value: FdrAPI.ApiDefinitionId | undefined;
    children: ReactNode;
}) {
    return <ApiDefinitionIdContext.Provider value={value}>{children}</ApiDefinitionIdContext.Provider>;
}

export function useApiDefinitionIdFromContext(): FdrAPI.ApiDefinitionId | undefined {
    return useContext(ApiDefinitionIdContext);
}
