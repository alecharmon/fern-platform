import { FernNavigation } from "@fern-api/fdr-sdk";

/**
 * Common interface for page data used across storage systems
 */
export interface PageData {
  html: string;
  frontmatter: Record<string, any>;
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
}

/**
 * Navigation context for client pages
 * Used to maintain product/version/tab selection when creating and storing client pages
 */
export interface NavigationContext {
  currentProduct?: FernNavigation.ProductNode;
  currentVersion?: FernNavigation.VersionNode;
  currentTab?: FernNavigation.TabChild;
  isCurrentVersionDefault?: boolean;
  isCurrentProductDefault?: boolean;
}
