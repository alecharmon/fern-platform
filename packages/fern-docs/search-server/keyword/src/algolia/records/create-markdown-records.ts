import { chunkToBytes, isNonNullish, measureBytes, truncateToBytes } from "@fern-api/ui-core-utils";
import { getFrontmatter, type MarkdownSectionRoot, markdownToString, splitMarkdownIntoSections } from "@fern-docs/mdx";
import { maybePrepareMdxContent } from "@fern-docs/search-utils";
import { compact, flatten } from "es-toolkit/array";
import { decode } from "html-entities";

import type { BaseRecord, Hierarchy, MarkdownRecord } from "../types";

type Level = "h0" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function toLevel(depth: number): Level | undefined {
    switch (depth) {
        case 0:
            return "h0";
        case 1:
            return "h1";
        case 2:
            return "h2";
        case 3:
            return "h3";
        case 4:
            return "h4";
        case 5:
            return "h5";
        case 6:
            return "h6";
        default:
            return undefined;
    }
}

function setHierarchyAtDepth(h: Hierarchy, depth: number, value: { id: string; title: string }): void {
    switch (depth) {
        case 1:
            h.h1 = value;
            break;
        case 2:
            h.h2 = value;
            break;
        case 3:
            h.h3 = value;
            break;
        case 4:
            h.h4 = value;
            break;
        case 5:
            h.h5 = value;
            break;
        case 6:
            h.h6 = value;
            break;
    }
}

interface CreateMarkdownRecordsOptions {
    base: BaseRecord;
    markdown: string;
}

// TODO: the `<If>` component is not supported, and will show up in search results!
export function createMarkdownRecords({ base, markdown }: CreateMarkdownRecordsOptions): MarkdownRecord[] {
    const { data, content } = getFrontmatter(markdown);

    /**
     * If the title is not set in the frontmatter, use the title from the sidebar.
     */
    // TODO: handle case where title is set in <h1> tag (this should be an upstream utility)
    const data_title = markdownToString(data.title);
    const title = data_title != null ? decode(data_title) : base.title;

    const sections = [...splitMarkdownIntoSections(content)];

    // use a set to de-duplicate records
    // meta descriptions will be pre-pended to the root node, so we need to collect them here:
    const metaDescriptions = Array.from(
        new Set([data.description, data.subtitle ?? data.excerpt, data["og:description"]])
    );

    // the root content can be missing if there is a subheading that immediately after the top of the page.
    let rootContent: string | undefined;
    if (sections[0]?.type === "root") {
        const rootSection = sections.shift() as MarkdownSectionRoot;
        rootContent = rootSection.content;
    }

    // collect all meta descriptions along with the root content, all of which can be used for string matching
    const description = [...metaDescriptions]
        .filter(isNonNullish)
        .map((text) => text.trim())
        .filter((text) => text.length > 0)
        .join("\n\n");

    const records: MarkdownRecord[] = [];

    const { content: description_content, code_snippets: description_code_snippets } =
        maybePrepareMdxContent(description);
    const { content: root_content, code_snippets: root_code_snippets } = maybePrepareMdxContent(rootContent);
    const code_snippets = flatten(compact([base.code_snippets, description_code_snippets, root_code_snippets])).filter(
        (codeSnippet) => measureBytes(codeSnippet.code) < 2000
    );

    const chunked_root_content = root_content != null ? chunkToBytes(root_content, 50 * 1000) : [];

    const base_markdown_record: MarkdownRecord = {
        ...base,
        type: "markdown",
        keywords: data.keywords
    };

    const base_root_markdown_record: MarkdownRecord = {
        ...base_markdown_record,
        title,
        hash: undefined,
        description: description_content != null ? truncateToBytes(description_content, 50 * 1000) : undefined,
        code_snippets: code_snippets.length > 0 ? code_snippets : undefined
    };

    if (chunked_root_content.length === 0) {
        // we should still insert this record even if there's no content, because
        // the title of the record can still be matched
        records.push(base_root_markdown_record);
    } else {
        chunked_root_content.forEach((chunk, i) => {
            records.push({
                ...base_root_markdown_record,
                content: chunk,
                objectID: `${base_root_markdown_record.objectID}-chunk:${i}`
            });
        });
    }

    const headingsWithContent = new Set<string>();
    const parentHeadingCandidates = new Map<
        string,
        {
            heading: { id: string; title: string; depth: number };
            parents: Array<{ id: string; title: string; depth: number }>;
        }
    >();

    sections.forEach((section, i) => {
        if (section.type === "root") {
            // the root section should have been shifted off this array earlier
            throw new Error(`Invariant: unexpected root section detected at index=${i + 1}`);
        }

        const { heading, content: markdownContent, parents } = section;

        headingsWithContent.add(heading.id);

        for (const parent of parents) {
            if (!parentHeadingCandidates.has(parent.id)) {
                parentHeadingCandidates.set(parent.id, { heading: parent, parents });
            }
        }

        const h1 = parents.find((p) => p.depth === 1);
        const h2 = parents.find((p) => p.depth === 2);
        const h3 = parents.find((p) => p.depth === 3);
        const h4 = parents.find((p) => p.depth === 4);
        const h5 = parents.find((p) => p.depth === 5);
        const h6 = parents.find((p) => p.depth === 6);

        const hierarchy: Hierarchy = {
            h0: { title },
            h1: h1 ? { id: h1.id, title: decode(h1.title) } : undefined,
            h2: h2 ? { id: h2.id, title: decode(h2.title) } : undefined,
            h3: h3 ? { id: h3.id, title: decode(h3.title) } : undefined,
            h4: h4 ? { id: h4.id, title: decode(h4.title) } : undefined,
            h5: h5 ? { id: h5.id, title: decode(h5.title) } : undefined,
            h6: h6 ? { id: h6.id, title: decode(h6.title) } : undefined
        };

        setHierarchyAtDepth(hierarchy, heading.depth, {
            id: heading.id,
            title: decode(markdownToString(heading.title))
        });

        const prepared = maybePrepareMdxContent(markdownContent);
        const code_snippets = flatten(compact([base.code_snippets, prepared.code_snippets])).filter(
            (codeSnippet) => measureBytes(codeSnippet.code) < 2000
        );

        const chunked_content = prepared.content != null ? chunkToBytes(prepared.content, 50 * 1000) : [];

        chunked_content.forEach((chunk, chunkIndex) => {
            const record: MarkdownRecord = {
                ...base_markdown_record,
                objectID: `${base.objectID}-${heading.id}-chunk:${chunkIndex}`,
                title: decode(markdownToString(heading.title)),
                hash: `#${heading.id}`,
                content: chunk,
                code_snippets: code_snippets.length > 0 ? code_snippets : undefined,
                hierarchy,
                level: toLevel(heading.depth),
                page_position: chunkIndex + 1
            };

            records.push(record);
        });
    });

    for (const { heading: parentHeading, parents } of parentHeadingCandidates.values()) {
        if (headingsWithContent.has(parentHeading.id)) {
            continue;
        }

        const h1 = parents.find((p) => p.depth === 1);
        const h2 = parents.find((p) => p.depth === 2);
        const h3 = parents.find((p) => p.depth === 3);
        const h4 = parents.find((p) => p.depth === 4);
        const h5 = parents.find((p) => p.depth === 5);
        const h6 = parents.find((p) => p.depth === 6);

        const hierarchy: Hierarchy = {
            h0: { title },
            h1: h1 ? { id: h1.id, title: decode(h1.title) } : undefined,
            h2: h2 ? { id: h2.id, title: decode(h2.title) } : undefined,
            h3: h3 ? { id: h3.id, title: decode(h3.title) } : undefined,
            h4: h4 ? { id: h4.id, title: decode(h4.title) } : undefined,
            h5: h5 ? { id: h5.id, title: decode(h5.title) } : undefined,
            h6: h6 ? { id: h6.id, title: decode(h6.title) } : undefined
        };

        setHierarchyAtDepth(hierarchy, parentHeading.depth, {
            id: parentHeading.id,
            title: decode(parentHeading.title)
        });

        const record: MarkdownRecord = {
            ...base_markdown_record,
            objectID: `${base.objectID}-${parentHeading.id}`,
            title: decode(parentHeading.title),
            hash: `#${parentHeading.id}`,
            content: undefined,
            code_snippets: undefined,
            hierarchy,
            level: toLevel(parentHeading.depth),
            page_position: 1
        };

        records.push(record);
    }

    return records;
}
