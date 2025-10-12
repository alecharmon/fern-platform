import "server-only";

import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type { TableOfContentsItem } from "@fern-docs/mdx";
import type React from "react";
import { UnreachableCaseError } from "ts-essentials";

import { CustomLayout } from "./CustomLayout";
import { GuideLayout } from "./GuideLayout";
import { OverviewLayout } from "./OverviewLayout";
import { PageLayout } from "./PageLayout";
import { ReferenceLayout } from "./ReferenceLayout";
import { TableOfContentsLayout } from "./TableOfContentsLayout";

export async function AbstractLayoutEvaluatorContent({
    frontmatter,
    tableOfContents,
    children,
    aside,
    pageHeader,
    builtWithFern,
    footer
}: {
    pageHeader?: React.ReactNode;
    frontmatter?: Partial<FernDocs.Frontmatter>;
    tableOfContents: TableOfContentsItem[];
    children: React.ReactNode;
    aside?: React.ReactNode;
    builtWithFern?: React.ReactNode;
    footer?: React.ReactNode;
}) {
    let layout = frontmatter?.layout ?? "guide";

    if (aside) {
        layout = "reference";
    }

    const toc = (
        <TableOfContentsLayout tableOfContents={tableOfContents} hideTableOfContents={frontmatter?.["hide-toc"]} />
    );

    switch (layout) {
        case "custom":
            return <CustomLayout footer={builtWithFern}>{children}</CustomLayout>;
        case "guide":
            return (
                <GuideLayout header={pageHeader} toc={toc} footer={footer}>
                    {children}
                </GuideLayout>
            );
        case "overview":
            return (
                <OverviewLayout header={pageHeader} toc={toc} footer={footer}>
                    {children}
                </OverviewLayout>
            );
        case "page":
            return (
                <PageLayout header={pageHeader} footer={footer}>
                    {children}
                </PageLayout>
            );
        case "reference":
            return (
                <ReferenceLayout header={pageHeader} aside={aside} footer={footer} kind="guide">
                    {children}
                </ReferenceLayout>
            );
        default:
            throw new UnreachableCaseError(layout);
    }
}
