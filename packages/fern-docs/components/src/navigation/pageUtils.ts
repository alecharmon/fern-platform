import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { mdxToHtml } from "@fern-docs/mdx";

import { createMdxFrontmatter } from "../navigation";
import {
  BuildPageDataProps,
  BuildPageDataResult,
  NavigationNodeLike,
  SectionWithHierarchy,
  StoredNavigationData,
} from "./types";

// Display strings for unnamed sections
export const UNNAMED_SECTION_DISPLAY_NAMES = {
  ROOT: "Root",
  UNNAMED: "Untitled Section",
} as const;

/**
 * Helper function to process nested sections/groups
 */
function processNestedSections(
  children: FernNavigation.NavigationNode[],
  sections: SectionWithHierarchy[],
  parentTitles: string[],
  currentTitle: string,
  nodeId: FernNavigation.NodeId
): void {
  // Check if children contain sections/groups (only recurse if they do)
  const hasNestedSectionsOrGroups = children.some(
    (child) =>
      child.type === "section" || (child as any).type === "sidebarGroup"
  );

  if (hasNestedSectionsOrGroups) {
    sections.push(
      ...getAllSections(children, [...parentTitles, currentTitle], nodeId)
    );
  }
}

/**
 * Recursively find all section nodes in the navigation tree with parent hierarchy.
 * Creates unnamed sections for direct page collections.
 */
export function getAllSections(
  nodes: FernNavigation.NavigationNode[],
  parentTitles: string[] = [],
  realParentId?: FernNavigation.NodeId
): SectionWithHierarchy[] {
  const sections: SectionWithHierarchy[] = [];

  // Single pass to check for pages and section containers
  let hasDirectPages = false;
  let hasProperSectionContainer = false;

  for (const node of nodes) {
    if (node.type === "page") hasDirectPages = true;
    else if (node.type === "section" || node.type === "sidebarGroup")
      hasProperSectionContainer = true;

    // Early exit if both conditions are found
    if (hasDirectPages && hasProperSectionContainer) break;
  }

  // Create unnamed section only at root level (parentTitles.length === 0) when pages exist without sections
  // This prevents creating synthetic sections inside real sections
  if (
    hasDirectPages &&
    !hasProperSectionContainer &&
    parentTitles.length === 0
  ) {
    // Create deterministic ID (always "root" at this point since parentTitles.length === 0)
    const deterministicId = "unnamed-section-root";

    // Note: This block is at root level only (parentTitles.length === 0), so no warning needed

    const unnamedSection: SectionWithHierarchy = {
      type: "section",
      id: deterministicId as FernNavigation.NodeId,
      title: UNNAMED_SECTION_DISPLAY_NAMES.ROOT, // Always root at this level
      slug: "root" as FernNavigation.Slug,
      children: nodes.filter((node) => node.type === "page"),
      parentTitles,
      realParentId, // Store the real parent node ID for client page creation
      isUnnamed: true, // Mark as synthetic unnamed section
      availability: undefined,
      canonicalSlug: undefined,
      icon: undefined,
      hidden: undefined,
      authed: undefined,
      viewers: undefined,
      orphaned: undefined,
      featureFlags: undefined,
      noindex: undefined,
      collapsed: undefined,
      overviewPageId: undefined,
      pointsTo: undefined,
    };

    sections.push(unnamedSection);
  }

  for (const node of nodes) {
    if (node.type === "section") {
      const sectionNode = node as FernNavigation.SectionNode;
      const sectionWithHierarchy: SectionWithHierarchy = {
        ...sectionNode,
        parentTitles,
      };
      sections.push(sectionWithHierarchy);

      // Process nested sections if they exist
      if ("children" in node && node.children) {
        processNestedSections(
          node.children,
          sections,
          parentTitles,
          sectionNode.title ||
            sectionNode.slug ||
            UNNAMED_SECTION_DISPLAY_NAMES.UNNAMED,
          sectionNode.id
        );
      }
    } else if (node.type === "sidebarGroup") {
      // Treat sidebarGroup as a section-like container
      const sidebarGroupNode = node as any; // sidebarGroup type

      // For root-level sidebarGroups without explicit titles, use "Root" and mark as unnamed
      const hasExplicitTitle = Boolean(
        sidebarGroupNode.title || sidebarGroupNode.slug
      );
      const isRootLevel = parentTitles.length === 0;
      const title =
        sidebarGroupNode.title ||
        sidebarGroupNode.slug ||
        (isRootLevel
          ? UNNAMED_SECTION_DISPLAY_NAMES.ROOT
          : UNNAMED_SECTION_DISPLAY_NAMES.UNNAMED);

      const sectionWithHierarchy: SectionWithHierarchy = {
        type: "section",
        id: sidebarGroupNode.id,
        title,
        slug: sidebarGroupNode.slug,
        children: sidebarGroupNode.children || [],
        parentTitles,
        availability: sidebarGroupNode.availability,
        canonicalSlug: sidebarGroupNode.canonicalSlug,
        icon: sidebarGroupNode.icon,
        hidden: sidebarGroupNode.hidden,
        authed: sidebarGroupNode.authed,
        viewers: sidebarGroupNode.viewers,
        orphaned: sidebarGroupNode.orphaned,
        featureFlags: sidebarGroupNode.featureFlags,
        noindex: sidebarGroupNode.noindex,
        collapsed: sidebarGroupNode.collapsed,
        overviewPageId: sidebarGroupNode.overviewPageId,
        pointsTo: sidebarGroupNode.pointsTo,
        // Mark root-level sidebarGroups without explicit titles as unnamed sections
        isUnnamed: isRootLevel && !hasExplicitTitle,
      };
      sections.push(sectionWithHierarchy);

      // Process nested sections if they exist
      if ("children" in node && node.children) {
        processNestedSections(
          node.children,
          sections,
          parentTitles,
          sidebarGroupNode.title ||
            sidebarGroupNode.slug ||
            (isRootLevel
              ? UNNAMED_SECTION_DISPLAY_NAMES.ROOT
              : UNNAMED_SECTION_DISPLAY_NAMES.UNNAMED),
          sidebarGroupNode.id
        );
      }
    } else if ("children" in node && node.children) {
      // For other non-section nodes, determine the appropriate parent ID
      const nodeTitle = "title" in node && node.title ? node.title : null;
      const newParentTitles = nodeTitle
        ? [...parentTitles, nodeTitle]
        : parentTitles;

      sections.push(
        ...getAllSections(node.children, newParentTitles, realParentId)
      );
    }
  }

  return sections;
}

export function findSectionTitle(
  nodes: NavigationNodeLike[],
  targetNodeId: NodeId
): string | null {
  for (const nodeItem of nodes) {
    if (nodeItem?.type && nodeItem?.id) {
      if (
        (nodeItem.type === "sidebarGroup" || nodeItem.type === "section") &&
        nodeItem.id === targetNodeId
      ) {
        return nodeItem.title || UNNAMED_SECTION_DISPLAY_NAMES.UNNAMED;
      }
      if (nodeItem.children && Array.isArray(nodeItem.children)) {
        const found = findSectionTitle(nodeItem.children, targetNodeId);
        if (found) return found;
      }
    }
  }
  return null;
}

export function createMdxFilename(
  fullSlug?: string,
  nodeSlug?: string
): string {
  return `${fullSlug || nodeSlug || "untitled"}.mdx`;
}

export function extractPageTitle(
  pageData?: { frontmatter?: { title?: unknown } },
  node?: { title?: unknown }
): string {
  return (
    pageData?.frontmatter?.title?.toString() ||
    (typeof node?.title === "string" ? node.title : undefined) ||
    "Untitled"
  );
}

export function createNavigationEntry(pageTitle: string, filename: string) {
  return { page: pageTitle, path: filename };
}

export function createDocsYmlUpdate(
  sectionTitle: string | null,
  pageEntry: { page: string; path: string },
  operation: "add" | "remove" = "add",
  tabSlug?: string
) {
  return {
    sectionTitle,
    tabSlug,
    pageEntry,
    createdAt: Date.now(),
    operation,
  };
}

function createFoundNode(
  nodeId: NodeId,
  title: string,
  slug: string
): FernNavigation.utils.Node.Found {
  return {
    type: "found",
    node: {
      type: "page",
      id: nodeId,
      title,
      slug,
      pageId: slug,
    } as FernNavigation.PageNode,
    sidebar: undefined,
    currentProduct: undefined,
    currentVersion: undefined,
    currentTab: undefined,
    isCurrentVersionDefault: false,
    isCurrentProductDefault: false,
  } as unknown as FernNavigation.utils.Node.Found;
}

function generateDefaultPageData(title: string, slug: string) {
  const initialMdx = createMdxFrontmatter({ title, slug });
  return mdxToHtml(initialMdx, {
    treatAsUnsupported: ["math"],
  });
}

export function buildPageDataFromSources(
  navigationData: StoredNavigationData,
  props: BuildPageDataProps
): BuildPageDataResult {
  const foundNode =
    props.serializableFoundNode ||
    (props.clientNodeId
      ? buildClientFoundNodes(navigationData)[props.clientNodeId]
      : undefined);

  // Create fallback foundNode if needed
  const workingFoundNode =
    foundNode ||
    createFoundNode(
      props.clientNodeId ||
        (props.initialFilename as NodeId) ||
        ("untitled" as NodeId),
      props.initialFrontmatter?.title?.toString() || "Untitled",
      props.initialFilename || "untitled"
    );

  const initialFilename =
    props.initialFilename ??
    ((workingFoundNode.node.type === "page" && workingFoundNode.node.pageId) ||
      workingFoundNode.node.slug);

  let { initialHtml, initialFrontmatter } = props;
  const { initialOriginalFrontmatter } = props;

  // Use stored page data if available
  if (props.clientNodeId) {
    const storedPage = navigationData.clientPages[props.clientNodeId]?.pageData;
    if (storedPage) {
      ({ html: initialHtml, frontmatter: initialFrontmatter } = storedPage);
    }
  } else if (initialFilename) {
    const storedPage = navigationData.pageContents[initialFilename];
    if (storedPage?.pageType === "server") {
      ({ html: initialHtml, frontmatter: initialFrontmatter } = storedPage);
    }
  }

  // Generate default data if missing
  if (!initialHtml || !initialFrontmatter) {
    const title = workingFoundNode.node.title || "Untitled";
    const slug = workingFoundNode.node.slug || initialFilename || "untitled";
    const defaultData = generateDefaultPageData(title, String(slug));

    initialHtml = defaultData.html;
    initialFrontmatter = defaultData.frontmatter;
  }

  return {
    initialFilename,
    initialHtml,
    initialFrontmatter,
    initialOriginalFrontmatter,
    foundNode: workingFoundNode,
  };
}

export function loadClientPageData(
  navigationData: StoredNavigationData,
  nodeId: NodeId
) {
  const clientNode = navigationData.clientPages[nodeId];
  if (!clientNode) {
    throw new Error("No client node found");
  }

  return {
    clientNode,
    loadClientPages: () => navigationData.clientPages,
  };
}

export function buildClientFoundNodes(
  navigationData: StoredNavigationData
): Record<NodeId, FernNavigation.utils.Node.Found> {
  const result: Record<NodeId, FernNavigation.utils.Node.Found> = {};

  Object.entries(navigationData.clientPages).forEach(([nodeId, storedPage]) => {
    if (!storedPage) return;

    const { node, sidebar, navigationContext } = storedPage;
    result[nodeId as NodeId] = {
      type: "found",
      node,
      sidebar,
      currentProduct: navigationContext?.currentProduct,
      currentVersion: navigationContext?.currentVersion,
      currentTab: navigationContext?.currentTab,
      isCurrentVersionDefault:
        navigationContext?.isCurrentVersionDefault ?? false,
      isCurrentProductDefault:
        navigationContext?.isCurrentProductDefault ?? false,
    } as FernNavigation.utils.Node.Found;
  });

  return result;
}

export function buildClientNodesByParent(
  navigationData: StoredNavigationData
): Record<NodeId, FernNavigation.PageNode[]> {
  const result: Record<NodeId, FernNavigation.PageNode[]> = {};

  Object.entries(navigationData.clientPages)
    .filter(([, storedPage]) => storedPage !== undefined)
    .sort(([, a], [, b]) => b.createdAt - a.createdAt)
    .forEach(([, storedPage]) => {
      const { node, parentNodeId } = storedPage;
      (result[parentNodeId] ??= []).push(node);
    });

  return result;
}

/**
 * Handles complex redirect logic for client pages that need tab context detection.
 * This utility is used by @sidebar/page.tsx for handling client pages that don't exist in server navigation.
 *
 * @param root - The root navigation node
 * @param slug - The original slug that was not found
 * @param initialRedirect - The initial redirect target from findNode
 * @returns The appropriate redirect target slug
 */
export function getClientPageRedirectTarget(
  root: FernNavigation.RootNode,
  slug: string,
  initialRedirect: string
): string {
  // First, try to understand what tab we should be in based on the original slug
  const originalFound = FernNavigation.utils.findNode(
    root,
    FernNavigation.Slug(slug)
  );
  let targetTabSlug = initialRedirect;

  // If we can determine the tab context from the slug structure, find the default page for that specific tab
  if (originalFound.type === "notFound") {
    // Try to find which tab this slug would belong to by checking tab prefixes
    const collector = FernNavigation.NodeCollector.collect(root);
    const tabNodes = collector
      .getNodesInOrder()
      .filter((node) => node.type === "tab") as FernNavigation.TabNode[];

    const slugParts = slug.split("/");
    for (const tab of tabNodes) {
      // Check if this client page belongs to this tab
      const tabSlugInPath = slugParts.includes(tab.slug);

      if (tabSlugInPath) {
        // Found the tab this client page should belong to
        let tabChildFound = FernNavigation.utils.findNode(root, tab.slug);

        // If the tab redirects (which is normal), follow the redirect
        if (tabChildFound.type === "redirect" && tabChildFound.redirect) {
          tabChildFound = FernNavigation.utils.findNode(
            root,
            tabChildFound.redirect
          );
        }

        if (tabChildFound.type === "found" && tabChildFound.sidebar) {
          // Use the found node's slug as the target to get the correct sidebar context
          targetTabSlug = tabChildFound.node.slug;
          break;
        }
      }
    }
  }

  return targetTabSlug;
}
