import { TypeDefinitionRoot as SharedTypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { ErrorBoundaryProvider } from "@fern-docs/components/providers/ErrorBoundaryProvider";

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
