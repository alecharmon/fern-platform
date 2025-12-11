import "server-only";

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
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
    footer,
    lang,
    theme
}: {
    pageHeader?: React.ReactNode;
    frontmatter?: Partial<FernDocs.Frontmatter>;
    tableOfContents: TableOfContentsItem[];
    children: React.ReactNode;
    aside?: React.ReactNode;
    builtWithFern?: React.ReactNode;
    footer?: React.ReactNode;
    lang: string;
    theme?: FernThemeConfig;
}) {
    let layout = frontmatter?.layout ?? "guide";

    if (aside) {
        layout = "reference";
    }

    const hideTableOfContents = frontmatter?.["hide-toc"];
    const showTableOfContents = tableOfContents != null && !hideTableOfContents && tableOfContents.length > 0;

    const toc = (
        <TableOfContentsLayout
            tableOfContents={tableOfContents}
            hideTableOfContents={hideTableOfContents}
            lang={lang}
        />
    );

    switch (layout) {
        case "custom":
            return <CustomLayout footer={builtWithFern}>{children}</CustomLayout>;
        case "guide":
            return (
                <GuideLayout
                    header={pageHeader}
                    toc={toc}
                    footer={footer}
                    theme={theme}
                    tableOfContents={showTableOfContents ? tableOfContents : undefined}
                    lang={lang}
                >
                    {children}
                </GuideLayout>
            );
        case "overview":
            return (
                <OverviewLayout
                    header={pageHeader}
                    toc={toc}
                    footer={footer}
                    theme={theme}
                    tableOfContents={showTableOfContents ? tableOfContents : undefined}
                    lang={lang}
                >
                    {children}
                </OverviewLayout>
            );
        case "page":
            return (
                <PageLayout header={pageHeader} footer={footer} theme={theme}>
                    {children}
                </PageLayout>
            );
        case "reference":
            return (
                <ReferenceLayout header={pageHeader} aside={aside} footer={footer} kind="guide" theme={theme}>
                    {children}
                </ReferenceLayout>
            );
        default:
            throw new UnreachableCaseError(layout);
    }
}
