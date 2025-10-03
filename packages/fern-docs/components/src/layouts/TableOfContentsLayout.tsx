import type { TableOfContentsItem } from "@fern-docs/mdx";

import { FernScrollArea } from "../FernScrollArea";
import { FERN_TOC_ID } from "../constants";
import { TableOfContents } from "../table-of-contents/TableOfContents";

interface TableOfContentsLayoutProps {
    tableOfContents: TableOfContentsItem[] | undefined;
    hideTableOfContents?: boolean;
}

export function TableOfContentsLayout({ tableOfContents, hideTableOfContents }: TableOfContentsLayoutProps) {
    const showTableOfContents = tableOfContents != null && !hideTableOfContents && tableOfContents.length > 0;

    return (
        <aside id={FERN_TOC_ID}>
            {showTableOfContents && (
                <FernScrollArea className="px-4 pb-12 pt-8 lg:pr-5">
                    <TableOfContents tableOfContents={tableOfContents} />
                </FernScrollArea>
            )}
        </aside>
    );
}
