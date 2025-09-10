import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { MdxToHtmlResponse, htmlToMdx } from "@fern-docs/mdx";

import {
  PageContents,
  PageDependencies,
  PageMetadata,
  PagesStoreEntry,
} from "../providers/PagesStore";

export function createPageEntry(
  metadata: PageMetadata,
  contents: PageContents,
  dependencies: Partial<PageDependencies> = {}
): PagesStoreEntry {
  return {
    metadata,
    contents,
    dependencies: {
      frontmatter: metadata,
      changed: false,
      syncedStatus: "SYNCED",
      ...dependencies,
    },
  };
}

export function compareFrontmatter(
  current: PageMetadata,
  initial: PageMetadata
): boolean {
  return JSON.stringify(current) === JSON.stringify(initial);
}

export function generateMdxFromHtml(
  html: string,
  frontmatter: PageMetadata
): string {
  try {
    return htmlToMdx(html, frontmatter).mdx;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate MDX from HTML: ${errorMessage}`);
  }
}

export function createPageKey(filename: string, clientNodeId?: NodeId): string {
  return `${filename}-${clientNodeId || "no-client-id"}`;
}

export function createPageMetadata(
  initialFrontmatter: MdxToHtmlResponse["frontmatter"],
  fallbackTitle?: string
): PageMetadata {
  return {
    title: initialFrontmatter?.title?.toString() || fallbackTitle || "Untitled",
    subtitle: initialFrontmatter?.subtitle?.toString(),
    slug: initialFrontmatter?.slug?.toString(),
    ...initialFrontmatter,
  };
}

export function createPageContents(
  initialHtml: MdxToHtmlResponse["html"],
  initialOriginalFrontmatter?: MdxToHtmlResponse["originalFrontmatter"],
  mdxContent?: string
): PageContents {
  return {
    html: initialHtml || "",
    mdx: mdxContent,
    originalFrontmatter: initialOriginalFrontmatter as PageMetadata | undefined,
  };
}

export function generatePageFilename(
  fullSlug?: string,
  nodeSlug?: string
): string {
  return `${fullSlug || nodeSlug || "untitled"}.mdx`;
}

export function isCompletePageData(data: unknown): data is {
  html: string;
  frontmatter: PageMetadata;
} {
  return (
    typeof data === "object" &&
    data != null &&
    typeof (data as any).html === "string" &&
    typeof (data as any).frontmatter === "object" &&
    (data as any).frontmatter != null
  );
}
