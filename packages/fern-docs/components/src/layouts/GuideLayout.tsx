import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { TableOfContentsItem } from "@fern-docs/mdx";
import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";
import { TableOfContentsMobile } from "../table-of-contents/TableOfContentsMobile";

interface GuideLayoutProps {
    header?: React.ReactNode;
    toc?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    theme?: FernThemeConfig;
    tableOfContents?: TableOfContentsItem[];
    lang?: string;
}

export function GuideLayout({ header, toc, children, footer, theme, tableOfContents, lang }: GuideLayoutProps) {
    const isCanvasTheme = theme?.body === "canvas";
    const content = (
        <>
            {toc}
            <div className="fern-layout-guide transition-all duration-500 ease-out">
                <article className="w-content-width max-w-full">
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
            <SetLayout value="guide" />
            {isCanvasTheme ? <div className="canvas-wrapper">{content}</div> : content}
        </>
    );
}
