import { htmlToMdx } from "@fern-docs/mdx";

import { PageData } from "./types";

/**
 * Converts page data to MDX content
 * @param pageData - The page data to convert
 * @returns The MDX content string
 */
export function pageDataToMdx(pageData: PageData): string {
  return htmlToMdx(pageData.html, pageData.frontmatter).mdx;
}

/**
 * Determines the appropriate filename for a given slug
 * @param slug - The page slug
 * @returns The filename with .mdx extension
 */
export function getPageFilename(slug: string): string {
  return slug.endsWith(".mdx") ? slug : `${slug}.mdx`;
}
