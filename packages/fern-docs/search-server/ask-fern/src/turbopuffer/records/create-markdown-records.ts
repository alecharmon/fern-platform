import { createHash } from "crypto";

import { FernNavigation } from "@fern-api/fdr-sdk";
import {
  createDelimitedRolesetString,
  createViewersForNodes,
} from "@fern-docs/search-utils";

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
import { TurbopufferRecordWithoutVector } from "../types";

const SHARED_PROCESSORS = [
  maybeReplaceCarriageReturns,
  maybeRemoveStyleTags,
  maybeRemoveClassNameTags,
  maybeRemoveEmptyDivs,
  maybeRemoveIconTags,
  maybeRemoveExtraneousProps,
  maybeRemoveWrappingTags,
];

const CHUNK_PROCESSORS = [
  ...SHARED_PROCESSORS,
  maybeRemoveDuplicateNewlines,
  maybeRemoveLongWhitespace,
  maybeRemoveCodeBlocks,
];

const MARKDOWN_PROCESSORS = [...SHARED_PROCESSORS];

export async function createMarkdownRecords({
  node,
  parents,
  authed,
  markdown,
  url,
  isChangelog,
}: {
  node: FernNavigation.NavigationNodeWithMetadata;
  parents: readonly FernNavigation.NavigationNodeParent[];
  authed: boolean;
  markdown: string;
  url: string;
  isChangelog: boolean;
}): Promise<TurbopufferRecordWithoutVector[]> {
  const versionNode = parents.find(
    (n): n is FernNavigation.VersionNode => n.type === "version"
  );

  const productNode = parents.find(
    (n): n is FernNavigation.ProductNode => n.type === "product"
  );

  const { roles, authed: isNodeAuthed } = createViewersForNodes(
    [...parents, node],
    authed
  );

  const markdownChunks = isChangelog ? [markdown] : chunkMarkdown(markdown);

  return markdownChunks.map((chunk, i) => {
    const processedChunk = postProcessChunk(chunk);
    return {
      id: createHash("sha256").update(`${node.id}-${i}`).digest("hex"),
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
      },
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
  return CHUNK_PROCESSORS.reduce(
    (processed, processor) => processor(processed),
    markdown
  );
}

function postProcessMarkdown(markdown: string): string {
  return MARKDOWN_PROCESSORS.reduce(
    (processed, processor) => processor(processed),
    markdown
  );
}
