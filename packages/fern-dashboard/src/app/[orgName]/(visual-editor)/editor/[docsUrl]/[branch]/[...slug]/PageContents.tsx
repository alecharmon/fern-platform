"use client";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { FernBreadcrumbs } from "@fern-docs/components/FernBreadcrumbs";
import type { SerializableFoundNode } from "@fern-docs/components/navigation";
import type { MdxToHtmlResponse } from "@fern-docs/mdx";
import { cn } from "@/utils/utils";
import PageEditor from "./PageEditor";
import PageSubtitle from "./PageSubtitle";
import PageTitle from "./PageTitle";

export declare namespace PageContents {
    export interface Props {
        filename: string;
        initialHtml: MdxToHtmlResponse["html"];
        initialFrontmatter: MdxToHtmlResponse["frontmatter"];
        foundNode?: SerializableFoundNode;
    }
}

export default function PageContents({ filename, initialHtml, initialFrontmatter, foundNode }: PageContents.Props) {
    const { title, subtitle, layout } = initialFrontmatter ?? {};

    const isCustomLayout = layout === "custom";

    const breadcrumb = foundNode ? FernNavigation.utils.createBreadcrumb(foundNode.parents) : [];

    return (
        <div className="max-w-content-width-wide mx-auto w-full pb-64">
            {!isCustomLayout && (
                <div className="mx-5 not-prose">
                    {breadcrumb.length > 0 && (
                        <div className="mb-2">
                            <FernBreadcrumbs breadcrumb={breadcrumb} />
                        </div>
                    )}
                    <PageTitle className="w-full" filename={filename} initialText={title ? String(title) : undefined} />
                    <PageSubtitle
                        className="w-full"
                        filename={filename}
                        initialText={subtitle ? String(subtitle) : undefined}
                    />
                </div>
            )}
            {/* NOTE: We add extra padding for custom layouts so that +/drag controls don't get cut off */}
            <PageEditor
                className={cn("-m-2 w-full p-3", isCustomLayout && "px-12")}
                filename={filename}
                initialHtml={initialHtml}
            />
        </div>
    );
}
