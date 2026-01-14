"use client";

import type { ApiSourceType } from "@fern-api/docs-loader";
import { createContext, type ReactNode, useContext } from "react";

interface OpenApiSpecsContextValue {
    /** Map of file path to file content */
    specs: Map<string, string> | null;
    /** The API source type detected from generators.yml */
    sourceType: ApiSourceType | null;
}

const OpenApiSpecsContext = createContext<OpenApiSpecsContextValue>({
    specs: null,
    sourceType: null
});

export interface OpenApiSpecsProviderProps {
    children: ReactNode;
    specs: Map<string, string> | null;
    sourceType: ApiSourceType | null;
}

export function OpenApiSpecsProvider({ children, specs, sourceType }: OpenApiSpecsProviderProps) {
    return <OpenApiSpecsContext.Provider value={{ specs, sourceType }}>{children}</OpenApiSpecsContext.Provider>;
}

/**
 * Hook to access OpenAPI specs data in the editor.
 * Returns the specs map and the detected API source type.
 */
export function useOpenApiSpecs() {
    return useContext(OpenApiSpecsContext);
}
