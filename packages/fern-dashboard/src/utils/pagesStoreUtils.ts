import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { MdxToHtmlResponse } from "@fern-docs/mdx";

import {
  PageContents,
  PageDependencies,
  PageMetadata,
  PagesStoreEntry,
} from "../providers/PagesStore";

export function createPageEntry(
  metadata: PageMetadata | null, // Optional because frontmatter is not required in source MDX
  contents: PageContents,
  dependencies: Partial<PageDependencies> = {}
): PagesStoreEntry {
  return {
    metadata: metadata ?? undefined,
    contents,
    dependencies: {
      frontmatter: metadata ?? undefined,
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

export function createPageKey(filename: string, clientNodeId?: NodeId): string {
  return `${filename}-${clientNodeId || "no-client-id"}`;
}

export function createPageMetadata(
  initialFrontmatter: MdxToHtmlResponse["frontmatter"],
  fallbackTitle?: string
): PageMetadata {
  return {
    title: initialFrontmatter?.title?.toString() || fallbackTitle,
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
    originalFrontmatter: initialOriginalFrontmatter,
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
