import {
    TypeDefinitionRoot as SharedTypeDefinitionRoot,
    TypeDefinitionContext
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { ErrorBoundaryProvider } from "@fern-docs/components/providers/ErrorBoundaryProvider";
import React from "react";

import { ErrorBoundary } from "@/docs/components/error-boundary";

// Re-export everything from the shared package
export {
    TypeDefinitionAnchorPart,
    TypeDefinitionCollapsible,
    TypeDefinitionContext,
    TypeDefinitionPathPart,
    TypeDefinitionResponse,
    TypeDefinitionUncollapsible,
    useAnchorId,
    useHref,
    useIsActive,
    useOptionalTypeDefinitionContext,
    useTypeDefinition,
    useTypeDefinitionContext
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";

/**
 * Dashboard-specific wrapper that marks children as being in a request context.
 * Used by the OpenAPI description editing feature to determine whether properties
 * are in request bodies (vs response bodies) for correct path resolution.
 *
 * Note: This is intentionally in the dashboard package (not shared) because
 * the editing functionality is dashboard-specific.
 */
export function TypeDefinitionRequest({ children }: { children: React.ReactNode }) {
    const parentContextFn = React.useContext(TypeDefinitionContext);
    const contextValue = React.useMemo(
        () => () => {
            const parent = parentContextFn();
            return {
                ...parent,
                isResponse: false
            };
        },
        [parentContextFn]
    );
    return <TypeDefinitionContext.Provider value={contextValue}>{children}</TypeDefinitionContext.Provider>;
}

// Override TypeDefinitionRoot to inject dashboard-specific ErrorBoundary
export function TypeDefinitionRoot({
    children,
    types,
    slug
}: {
    children: React.ReactNode;
    types: Record<string, any>;
    slug: string;
}) {
    return (
        <ErrorBoundaryProvider ErrorBoundary={ErrorBoundary}>
            <SharedTypeDefinitionRoot types={types} slug={slug}>
                {children}
            </SharedTypeDefinitionRoot>
        </ErrorBoundaryProvider>
    );
}
