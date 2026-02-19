import { TOC_LINK_SENTINEL_URL_PREFIX } from "@fern-api/docs-pdf";
import type { ExportTocEntry } from "../docs-pdf-export-planner";
import styles from "./print.module.css";

function renderEntry(entry: ExportTocEntry, depth: number): React.ReactNode {
    return (
        <li key={entry.key} data-fern-toc-depth={depth}>
            {entry.type === "page" ? (
                <a
                    href={`${TOC_LINK_SENTINEL_URL_PREFIX}/${encodeURIComponent(entry.slug)}`}
                    data-fern-toc-item
                    data-fern-toc-row
                    data-fern-slug={entry.slug}
                    className={styles.row}
                    data-fern-toc-depth={depth}
                >
                    <span data-fern-toc-title style={{ fontWeight: depth <= 2 ? 700 : 600 }}>
                        {entry.title}
                    </span>
                    <span data-fern-toc-leader aria-hidden="true" className={styles.leader} />
                    <span data-fern-toc-page data-fern-slug={entry.slug} className={styles.pageNumber} />
                </a>
            ) : (
                <div className={styles.groupRow} data-fern-toc-depth={depth}>
                    <span className={styles.groupTitle} style={{ fontWeight: depth <= 2 ? 700 : 600 }}>
                        {entry.title}
                    </span>
                </div>
            )}
            {entry.children.length > 0 ? (
                <ol data-fern-toc-list className={styles.listNested}>
                    {entry.children.map((child) => renderEntry(child, depth + 1))}
                </ol>
            ) : null}
        </li>
    );
}

export function PrintTocTree({ entries, depth = 0 }: { entries: readonly ExportTocEntry[]; depth?: number }) {
    return entries.map((entry) => renderEntry(entry, depth));
}
