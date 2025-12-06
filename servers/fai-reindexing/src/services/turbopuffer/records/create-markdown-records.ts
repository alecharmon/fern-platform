import { FernNavigation, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import {
    createDelimitedRolesetString,
    createViewersForNodes,
    type TurbopufferRecordWithoutVector
} from "@fern-docs/search-utils";
import { createHash } from "crypto";
import { maybeRemoveCodeBlocks } from "../post-process/chunks/maybe-remove-code-blocks";
import { maybeRemoveDuplicateNewlines } from "../post-process/chunks/maybe-remove-duplicate-newlines";
import { maybeRemoveLongWhitespace } from "../post-process/chunks/maybe-remove-long-whitespace";
import { maybeRemoveClassNameTags } from "../post-process/shared/maybe-remove-class-name-tags";
import { maybeRemoveEmptyDivs } from "../post-process/shared/maybe-remove-empty-divs";
import { maybeRemoveExtraneousProps } from "../post-process/shared/maybe-remove-extraneous-props";
import { maybeRemoveIconTags } from "../post-process/shared/maybe-remove-icon-tags";
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
    maybeRemoveWrappingTags
];

const CHUNK_PROCESSORS = [
    ...SHARED_PROCESSORS,
    maybeRemoveDuplicateNewlines,
    maybeRemoveLongWhitespace,
    maybeRemoveCodeBlocks
];

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
                keywords: undefined,
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

function chunkMarkdown(markdown: string): string[] {
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

function postProcessChunk(markdown: string): string {
    return CHUNK_PROCESSORS.reduce((processed, processor) => processor(processed), markdown);
}

function postProcessMarkdown(markdown: string): string {
    return MARKDOWN_PROCESSORS.reduce((processed, processor) => processor(processed), markdown);
}
