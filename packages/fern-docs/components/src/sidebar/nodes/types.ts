import { OriginalElements } from "@fern-docs/mdx";

/**
 * Common interface for page data used across storage systems
 */
export interface PageData {
  html: string;
  frontmatter: Record<string, any>;
  originalElements: OriginalElements;
}

/**
 * Interface for page data with change tracking
 */
export interface PageDataWithChange extends PageData {
  changed?: boolean;
}

/**
 * Type for MDX content conversion result
 */
export interface MdxContent {
  html: string;
  frontmatter: Record<string, any>;
  originalElements: OriginalElements;
}
