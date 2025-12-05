import type { TableOfContentsItem } from "@fern-docs/mdx";
import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";
import { TableOfContentsMobile } from "../table-of-contents/TableOfContentsMobile";

interface GuideLayoutProps {
    header?: React.ReactNode;
    toc?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    tableOfContents?: TableOfContentsItem[];
    lang?: string;
}

export function GuideLayout({ header, toc, children, footer, tableOfContents, lang }: GuideLayoutProps) {
    return (
        <>
            <SetLayout value="guide" />
            {toc}
            <div className="fern-layout-guide transition-all duration-500 ease-out">
                <article className="w-content-width max-w-full">
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
