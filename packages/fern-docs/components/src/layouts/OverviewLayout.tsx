import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { TableOfContentsItem } from "@fern-docs/mdx";
import type React from "react";
import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";
import { TableOfContentsMobile } from "../table-of-contents/TableOfContentsMobile";
import { CanvasWrapper } from "./CanvasWrapper";

interface OverviewLayoutProps {
    header?: React.ReactNode;
    toc?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    theme?: FernThemeConfig;
    tableOfContents?: TableOfContentsItem[];
    lang?: string;
}

export function OverviewLayout({ header, toc, children, footer, theme, tableOfContents, lang }: OverviewLayoutProps) {
    const isCanvasTheme = theme?.body === "canvas";
    const content = (
        <>
            {toc}
            <div className="fern-layout-overview">
                <article className="w-content-wide-width max-w-full">
                    {tableOfContents && lang && (
                        <TableOfContentsMobile
                            tableOfContents={tableOfContents}
                            lang={lang}
                            className="fixed right-4 top-[calc(var(--header-height)+1rem)] z-50"
                        />
                    )}
                    {header}
                    <Prose className="prose-h1:mt-[1.5em] first:prose-h1:mt-0 max-w-full">{children}</Prose>
                </article>
                <div className="grow" />
                {footer}
            </div>
        </>
    );

    return (
        <>
            <SetLayout value="overview" />
            {isCanvasTheme ? <CanvasWrapper>{content}</CanvasWrapper> : content}
        </>
    );
}
