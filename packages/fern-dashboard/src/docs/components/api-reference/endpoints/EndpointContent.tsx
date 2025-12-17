"use client";

/**
 * Dashboard-specific EndpointContent (client-side, read-only).
 *
 * Main component for rendering HTTP endpoint API reference pages.
 * Uses ReferenceLayout with header, reference panel, and code snippets.
 * Excludes: playground, feedback, page actions.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/endpoints/EndpointContent.tsx
 */

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { EndpointContextProvider } from "@fern-docs/components/api-reference/endpoints/EndpointContext";
import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";
import { TypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { FernBreadcrumbs } from "@fern-docs/components/FernBreadcrumbs";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";

import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { EndpointContentCodeSnippets } from "./EndpointContentCodeSnippets";
import { EndpointContentLeft } from "./EndpointContentLeft";

function getAvailabilityBadge(endpoint: EndpointContext["endpoint"], node: EndpointContext["node"]) {
    const availability = endpoint.availability ?? node.availability;
    return availability ? <AvailabilityBadge availability={availability} rounded /> : null;
}

export interface EndpointContentProps {
    context: EndpointContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    showErrors: boolean;
    showAuth: boolean;
    lang: string;
}

export function EndpointContent({ context, breadcrumb, showErrors, showAuth, lang }: EndpointContentProps) {
    const { node, endpoint, types } = context;

    // Extract footer content from the description (simplified - just use description as-is)
    const description = endpoint.description;

    return (
        <EndpointContextProvider endpoint={endpoint}>
            <ReferenceLayout
                header={
                    <EndpointPageHeader
                        breadcrumb={breadcrumb}
                        title={node.title}
                        tags={getAvailabilityBadge(endpoint, node)}
                        endpoint={endpoint}
                        lang={lang}
                    />
                }
                aside={
                    <EndpointContentCodeSnippets endpoint={endpoint} showErrors={showErrors} node={node} lang={lang} />
                }
                reference={
                    <TypeDefinitionRoot types={types} slug={node.slug}>
                        <TypeDefinitionSlotsServer types={types} lang={lang}>
                            <EndpointContentLeft
                                context={context}
                                showAuth={showAuth}
                                showErrors={showErrors}
                                lang={lang}
                            />
                        </TypeDefinitionSlotsServer>
                    </TypeDefinitionRoot>
                }
            >
                <MdxContent mdx={description} />
            </ReferenceLayout>
        </EndpointContextProvider>
    );
}

/**
 * Simplified page header for dashboard (no page actions, no MDX serialization)
 */
function EndpointPageHeader({
    breadcrumb,
    title,
    tags,
    endpoint,
    lang
}: {
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    title: string;
    tags?: React.ReactNode;
    endpoint: EndpointContext["endpoint"];
    lang: string;
}) {
    return (
        <header className="my-8 space-y-2">
            {breadcrumb.length > 0 && (
                <div className="flex justify-between">
                    <FernBreadcrumbs breadcrumb={breadcrumb} />
                </div>
            )}

            <div className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-row items-center gap-4">
                    <h1 className="fern-page-heading text-balance break-words">{title}</h1>
                    {tags}
                </div>
            </div>

            <EndpointUrlWithOverflow
                path={endpoint.path}
                method={endpoint.method}
                environmentId={undefined}
                baseUrl={endpoint.environments?.[0]?.baseUrl}
                showEnvironment={true}
                className={endpoint.protocol?.type === "grpc" ? "hidden" : "hidden lg:flex"}
                lang={lang}
            />
        </header>
    );
}
