import "server-only";

import type { FernNavigation } from "@fern-api/fdr-sdk";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernLink } from "@fern-docs/components/FernLink";
import { ChevronLeft } from "lucide-react";
import React from "react";

import { MdxServerComponent } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";

import { FernBreadcrumbs } from "./FernBreadcrumbs";
import { PageActionsDropdown } from "./PageActionsDropdown";
import { PageFilters } from "./PageFilters";
import { RSSFeedButton } from "./RSSFeedButton";

export function PageHeader({
    slug,
    serialize,
    breadcrumb,
    title,
    titleHref,
    action,
    tags,
    subtitle,
    children,
    markdownPromise,
    pageActionOptions,
    showRssFeedButton,
    filters,
    showBackIcon
}: {
    slug: string;
    serialize: MdxSerializer;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    title: string;
    titleHref?: string;
    action?: React.ReactNode;
    subtitle?: string;
    tags?: React.ReactNode;
    children?: React.ReactNode;
    markdownPromise?: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    pageActionOptions?: FernDropdown.PageActionOption[];
    showRssFeedButton?: boolean;
    // tags for the changelog section
    filters?: string[];
    showBackIcon?: boolean;
}) {
    return (
        <header className="my-8 space-y-2">
            {(breadcrumb.length > 0 || tags) && (
                <div className="flex justify-between">
                    <FernBreadcrumbs breadcrumb={breadcrumb} />
                </div>
            )}

            <WithAction action={action}>
                <div className="flex flex-row items-center justify-between gap-2">
                    <div className="flex flex-row items-center gap-4">
                        {showBackIcon && titleHref != null ? (
                            <FernLink href={titleHref} scroll={true} className="group w-fit">
                                <div
                                    className="flex flex-row items-center pl-2 pr-4 py-1.5 -ml-2 group-hover:bg-(color:--grayscale-a2) transition-colors"
                                    style={{ gap: "8px", borderRadius: "8px" }}
                                >
                                    <ChevronLeft className="size-icon-md text-(color:--grayscale-a11)" />
                                    <h1 className="fern-page-heading text-balance break-words">
                                        <MdxServerComponent serialize={serialize} mdx={title} slug={slug} />
                                    </h1>
                                </div>
                            </FernLink>
                        ) : (
                            <div className="flex flex-row items-center" style={{ gap: "8px" }}>
                                {titleHref == null ? (
                                    <h1 className="fern-page-heading text-balance break-words">
                                        <MdxServerComponent serialize={serialize} mdx={title} slug={slug} />
                                    </h1>
                                ) : (
                                    <FernLink href={titleHref} scroll={true}>
                                        <h1 className="fern-page-heading text-balance break-words">
                                            <MdxServerComponent serialize={serialize} mdx={title} slug={slug} />
                                        </h1>
                                    </FernLink>
                                )}
                            </div>
                        )}
                        {tags}
                    </div>
                    {pageActionOptions && (
                        <div className="hidden md:flex">
                            <PageActionsDropdown
                                markdownPromise={markdownPromise}
                                pageActionOptions={pageActionOptions}
                            />
                        </div>
                    )}
                    {showRssFeedButton && (
                        <div className="hidden md:flex">
                            <RSSFeedButton />
                        </div>
                    )}
                </div>
            </WithAction>

            {subtitle && (
                <div className="prose-p:text-(color:--grayscale-a11) mt-2 break-words leading-7">
                    <React.Suspense fallback={subtitle}>
                        <MdxServerComponent serialize={serialize} mdx={subtitle} slug={slug} />
                    </React.Suspense>
                </div>
            )}

            {filters && filters.length > 0 && (
                <>
                    <hr className="my-4" />
                    <div className="flex flex-row gap-2 overflow-x-auto">
                        <PageFilters filters={filters} />
                    </div>
                </>
            )}

            {children}
        </header>
    );
}

function WithAction({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    if (!action) {
        return children;
    }

    return (
        <div className="flex items-center justify-between">
            {children}
            {action}
        </div>
    );
}
