import { TypeDefinitionRoot as SharedTypeDefinitionRoot } from "@fern-api/endpoint-snippet-dependencies";

import { ErrorBoundary } from "@/docs/components/error-boundary";

// Re-export everything from the shared package
export * from "@fern-api/endpoint-snippet-dependencies";

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
        <SharedTypeDefinitionRoot types={types} slug={slug} ErrorBoundary={ErrorBoundary}>
            {children}
        </SharedTypeDefinitionRoot>
    );
}
