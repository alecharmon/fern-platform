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

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { EndpointContextProvider } from "@fern-docs/components/api-reference/endpoints/EndpointContext";
import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";
import { TypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { FernBreadcrumbs } from "@fern-docs/components/FernBreadcrumbs";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { useMemo } from "react";

import { DescriptionEditButton } from "@/components/editor/DescriptionEditButton";
import { MouseFollowingTooltip } from "@/components/editor/MouseFollowingTooltip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";
import { useApiEditTarget } from "@/providers/ApiEditTargetContext";
import { type DescriptionTarget, useDescriptionEditability, useLiveDescription } from "@/providers/OpenApiSpecsContext";

import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { EndpointContentCodeSnippets } from "./EndpointContentCodeSnippets";
import { EndpointContentLeft } from "./EndpointContentLeft";

function getAvailabilityBadge(endpoint: EndpointContext["endpoint"], node: EndpointContext["node"]) {
    const availability = endpoint.availability ?? node.availability;
    return availability ? <AvailabilityBadge availability={availability} rounded /> : null;
}

/**
 * Editable description for the main endpoint description.
 * Wraps MdxContent with edit button support for endpoint-level descriptions.
 */
function EditableEndpointDescription({ endpoint }: { endpoint: EndpointContext["endpoint"] }) {
    const apiEditTarget = useApiEditTarget();

    // Build the path string for the description target
    const pathString = useMemo(() => {
        return endpoint.path.map((part) => (part.type === "literal" ? part.value : `{${part.value}}`)).join("");
    }, [endpoint.path]);

    // Create endpoint description target
    const target = useMemo((): DescriptionTarget | null => {
        if (!apiEditTarget || apiEditTarget.type !== "endpoint") {
            return null;
        }
        return {
            type: "endpoint",
            operationId: endpoint.operationId,
            method: endpoint.method,
            path: pathString
        };
    }, [apiEditTarget, endpoint.operationId, endpoint.method, pathString]);

    const { isEditable, reason } = useDescriptionEditability(target);

    // Get live value from specs context if available (enables UI updates after editing)
    const liveDescription = useLiveDescription(target, endpoint.description);

    // If no edit target, just render MdxContent
    if (!target) {
        return <MdxContent mdx={endpoint.description} />;
    }

    // When no description, show "add" button on hover (only if editable)
    if (!liveDescription) {
        if (isEditable) {
            return (
                <div className="group/desc opacity-0 transition-opacity hover:opacity-100">
                    <DescriptionEditButton target={target} currentValue="" />
                </div>
            );
        }
        // Non-editable with no description: nothing to show
        return null;
    }

    // Has description: editable gets edit button, non-editable gets mouse-following tooltip
    if (isEditable) {
        return (
            <div className="group/desc flex items-start gap-1">
                <MdxContent mdx={liveDescription} className="min-w-0 flex-1" />
                <div className="shrink-0 opacity-0 transition-opacity group-hover/desc:opacity-100">
                    <DescriptionEditButton target={target} currentValue={liveDescription ?? ""} />
                </div>
            </div>
        );
    }

    return (
        <MouseFollowingTooltip reason={reason}>
            <MdxContent mdx={liveDescription} />
        </MouseFollowingTooltip>
    );
}

export interface EndpointContentProps {
    context: EndpointContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    showErrors: boolean;
    showAuth: boolean;
    lang: string;
    theme?: FernThemeConfig;
}

export function EndpointContent({ context, breadcrumb, showErrors, showAuth, lang, theme }: EndpointContentProps) {
    const { node, endpoint, types } = context;

    return (
        <EndpointContextProvider endpoint={endpoint}>
            <ReferenceLayout
                theme={theme}
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
                <EditableEndpointDescription endpoint={endpoint} />
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
