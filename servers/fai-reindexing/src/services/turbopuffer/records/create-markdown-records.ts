import { FernNavigation, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import {
    createDelimitedRolesetString,
    createViewersForNodes,
    type TurbopufferRecordWithoutVector
} from "@fern-docs/search-utils";
import { createHash } from "crypto";
import { maybeRemoveDuplicateNewlines } from "../post-process/chunks/maybe-remove-duplicate-newlines";
import { maybeRemoveLongWhitespace } from "../post-process/chunks/maybe-remove-long-whitespace";
import { maybeRemoveClassNameTags } from "../post-process/shared/maybe-remove-class-name-tags";
import { maybeRemoveEmptyDivs } from "../post-process/shared/maybe-remove-empty-divs";
import { maybeRemoveExtraneousProps } from "../post-process/shared/maybe-remove-extraneous-props";
import { maybeRemoveIconTags } from "../post-process/shared/maybe-remove-icon-tags";
import { maybeRemoveIfComponents } from "../post-process/shared/maybe-remove-if-components";
import { maybeRemoveStyleTags } from "../post-process/shared/maybe-remove-style-tags";
import { maybeRemoveWrappingTags } from "../post-process/shared/maybe-remove-wrapping-tags";
import { maybeReplaceCarriageReturns } from "../post-process/shared/maybe-replace-carriage-returns";

const SHARED_PROCESSORS = [
    maybeReplaceCarriageReturns,
    maybeRemoveStyleTags,
    maybeRemoveClassNameTags,
    maybeRemoveEmptyDivs,
    maybeRemoveIconTags,
    maybeRemoveExtraneousProps,
    maybeRemoveWrappingTags,
    maybeRemoveIfComponents
];

const CHUNK_PROCESSORS = [...SHARED_PROCESSORS, maybeRemoveDuplicateNewlines, maybeRemoveLongWhitespace];

const MARKDOWN_PROCESSORS = [...SHARED_PROCESSORS];

export async function createMarkdownRecords({
    node,
    parents,
    authed,
    markdown,
    url,
    isChangelog,
    pageId
}: {
    node: FernNavigationType.NavigationNodeWithMetadata;
    parents: readonly FernNavigationType.NavigationNodeParent[];
    authed: boolean;
    markdown: string;
    url: string;
    isChangelog: boolean;
    pageId: string;
}): Promise<TurbopufferRecordWithoutVector[]> {
    const versionNode = parents.find((n): n is FernNavigationType.VersionNode => n.type === "version");

    const productNode = parents.find((n): n is FernNavigationType.ProductNode => n.type === "product");

    const { roles, authed: isNodeAuthed } = createViewersForNodes([...parents, node], authed);

    const breadcrumbs = FernNavigation.utils
        .createBreadcrumb([...parents, node])
        .map((b) => b.title)
        .join(", ");

    const markdownChunks = isChangelog ? [markdown] : chunkMarkdown(markdown);

    return markdownChunks.map((chunk, i) => {
        const processedChunk = postProcessChunk(chunk);
        const extractedKeywords = extractKeywordsFromChunk(chunk);
        const keywords = extractedKeywords.length > 0 ? extractedKeywords : undefined;
        const recordId = createHash("sha256").update(`${node.id}-${i}`).digest("hex");
        return {
            id: recordId,
            attributes: {
                chunk: processedChunk,
                title: node.title,
                document: postProcessMarkdown(markdown),
                version: versionNode?.title,
                product: productNode?.title,
                description: undefined,
                keywords,
                authed: isNodeAuthed,
                roles: roles.map((role) => createDelimitedRolesetString(role)),
                url,
                content_type: "page",
                breadcrumbs,
                chunk_index: i,
                parent_id: pageId,
                parent_content_hash: createHash("sha256").update(markdown).digest("hex")
            }
        };
    });
}

export function chunkMarkdown(markdown: string): string[] {
    const chunks: string[] = [];

    // Split on ### headers
    const sections = markdown.split(/(?=### )/);
    sections.forEach((section) => {
        if (section.trim()) {
            // Then, split on ## headers
            const subsections = section.split(/(?=## )/);
            subsections.forEach((subsection) => {
                const trimmed = subsection.trim();
                if (trimmed && !/^#+$/.test(trimmed)) {
                    chunks.push(trimmed);
                }
            });
        }
    });

    // If no chunks were created (no headers found), use the entire markdown as one chunk
    if (chunks.length === 0) {
        chunks.push(markdown.trim());
    }

    return chunks;
}

export function extractKeywordsFromChunk(chunk: string): string[] {
    const keywords = new Set<string>();

    const headings = extractHeadings(chunk);
    headings.forEach((h) => keywords.add(h));

    const inlineCode = extractInlineCode(chunk);
    inlineCode.forEach((c) => keywords.add(c));

    const frontmatter = extractFrontmatterFields(chunk);
    frontmatter.forEach((f) => keywords.add(f));

    return Array.from(keywords);
}

function extractHeadings(chunk: string): string[] {
    const headings: string[] = [];
    const lines = chunk.split("\n");

    for (const line of lines) {
        const match = line.match(/^#{1,6}\s+(.+)$/);
        if (match) {
            headings.push(match[1].trim());
        }
    }

    return headings;
}

function extractInlineCode(chunk: string): string[] {
    const codeSnippets: string[] = [];
    const inlineCodeRegex = /`([^`\n]+)`/g;

    let match;
    while ((match = inlineCodeRegex.exec(chunk)) !== null) {
        const code = match[1].trim();
        if (code.length >= 2 && code.length <= 100 && !code.includes(" ")) {
            codeSnippets.push(code);
        }
    }

    return codeSnippets;
}

function extractFrontmatterFields(chunk: string): string[] {
    const fields: string[] = [];
    const frontmatterMatch = chunk.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
        return fields;
    }

    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split("\n");

    for (const line of lines) {
        const titleMatch = line.match(/^title:\s*(.+)$/);
        if (titleMatch) {
            fields.push(titleMatch[1].trim().replace(/^["']|["']$/g, ""));
        }
    }

    return fields;
}

function postProcessChunk(markdown: string): string {
    return CHUNK_PROCESSORS.reduce((processed, processor) => processor(processed), markdown);
}

function postProcessMarkdown(markdown: string): string {
    return MARKDOWN_PROCESSORS.reduce((processed, processor) => processor(processed), markdown);
}
