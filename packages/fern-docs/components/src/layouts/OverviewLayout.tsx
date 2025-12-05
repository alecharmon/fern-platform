import type { TableOfContentsItem } from "@fern-docs/mdx";
import type React from "react";

import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";
import { TableOfContentsMobile } from "../table-of-contents/TableOfContentsMobile";

interface OverviewLayoutProps {
    header?: React.ReactNode;
    toc?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    tableOfContents?: TableOfContentsItem[];
    lang?: string;
}

export function OverviewLayout({ header, toc, children, footer, tableOfContents, lang }: OverviewLayoutProps) {
    return (
        <>
            <SetLayout value="overview" />
            {toc}
            <div className="fern-layout-overview">
                <article className="w-content-wide-width max-w-full">
                    {tableOfContents && lang && (
                        <TableOfContentsMobile
                            tableOfContents={tableOfContents}
                            lang={lang}
                            className="mb-6 w-full sticky top-header-height z-10 py-2 bg-(color:--background)"
                        />
                    )}
                    {header}
                    <Prose className="prose-h1:mt-[1.5em] first:prose-h1:mt-0 max-w-full">{children}</Prose>
                    {footer}
                </article>
            </div>
        </>
    );
}
