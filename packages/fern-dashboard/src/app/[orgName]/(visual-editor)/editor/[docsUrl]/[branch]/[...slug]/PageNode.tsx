"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";

import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { ClientPageStorage, PageStorage } from "@fern-docs/components";
import { useSidebarClientNavigation } from "@fern-docs/components/sidebar/nodes/SidebarClientNavigationProvider";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { MdxToHtmlResponse, mdxToHtml } from "@fern-docs/mdx";

import { UnsupportedContent } from "@/components/editor/UnsupportedContent";
import { OriginalElementsProvider } from "@/providers/OriginalElementsContext";
import { createMdxFrontmatter } from "@/utils/createMdxFrontmatter";

import PageContents from "./PageContents";

type SerializableFoundNode = Pick<
  FernNavigation.utils.Node.Found,
  | "type"
  | "node"
  | "sidebar"
  | "currentTab"
  | "currentProduct"
  | "currentVersion"
  | "isCurrentVersionDefault"
  | "isCurrentProductDefault"
>;

export declare namespace PageNode {
  export interface Props {
    serializableFoundNode?: SerializableFoundNode;
    clientNodeId?: NodeId;
    initialFilename?: string;
    initialHtml?: MdxToHtmlResponse["html"];
    initialFrontmatter?: MdxToHtmlResponse["frontmatter"];
    initialOriginalElements?: MdxToHtmlResponse["originalElements"];
    initialOriginalFrontmatter?: MdxToHtmlResponse["originalFrontmatter"];
  }
}

export default function PageNode({
  serializableFoundNode,
  clientNodeId,
  ...props
}: PageNode.Props) {
  const params = useParams();
  const branchName = params.branch as string;
  const { clientFoundNodes } = useSidebarClientNavigation();
  const clientFoundNode = clientNodeId
    ? clientFoundNodes?.[clientNodeId]
    : undefined;

  const foundNode:
    | SerializableFoundNode
    | FernNavigation.utils.Node.Found
    | undefined = serializableFoundNode || clientFoundNode;

  if (!foundNode) {
    throw new Error("No node data provided by the server or client");
  }

  const initialFilename =
    props.initialFilename ??
    ((foundNode.node.type === "page" && foundNode.node.pageId) ||
      foundNode.node.slug);

  let initialHtml = props.initialHtml;
  let initialFrontmatter = props.initialFrontmatter;
  let initialOriginalElements = props.initialOriginalElements;
  const initialOriginalFrontmatter = props.initialOriginalFrontmatter;

  // Store server data for comparison (before we potentially override it with localStorage)
  // Memoize to keep object reference stable if there are no changes
  const serverData = useMemo(() => {
    return initialHtml && initialFrontmatter && initialOriginalElements
      ? {
          html: initialHtml,
          frontmatter: initialFrontmatter,
          originalElements: initialOriginalElements,
        }
      : undefined;
  }, [initialHtml, initialFrontmatter, initialOriginalElements]);

  if (clientNodeId) {
    // For client pages, ALWAYS use localStorage data (latest version) over any other data
    const storedPages = ClientPageStorage.loadClientPages(branchName);
    const storedPage = storedPages[clientNodeId];

    if (storedPage?.pageData) {
      initialHtml = storedPage.pageData.html;
      initialFrontmatter = storedPage.pageData.frontmatter;
      initialOriginalElements = storedPage.pageData.originalElements;
    }
  } else if (initialFilename) {
    // For server pages, prefer localStorage data if it exists and is newer
    const storedPage = PageStorage.getPage(branchName, initialFilename);

    if (storedPage && storedPage.pageType === "server") {
      // Use localStorage data as it represents the latest edited version
      initialHtml = storedPage.html;
      initialFrontmatter = storedPage.frontmatter;
      initialOriginalElements = storedPage.originalElements;
    }
  }

  // No initial data provided, so we need to generate it
  if (!initialHtml || !initialFrontmatter || !initialOriginalElements) {
    // Generate default MDX when server data is missing/incomplete
    // Common for client pages where server has no initial content to provide
    const initialMdx = createMdxFrontmatter({
      title: foundNode.node.title,
      slug: foundNode.node.slug,
    });
    const { html, frontmatter, originalElements } = mdxToHtml(initialMdx, {
      treatAsCustomElement: ["code"],
      treatAsUnsupported: ["math"],
    });
    initialHtml = html;
    initialFrontmatter = frontmatter;
    initialOriginalElements = originalElements;
  }

  const isUnsupportedNode =
    foundNode.node.type !== "page" && foundNode.node.type !== "section";

  return (
    <>
      <SetCurrentNavigationNode
        nodeId={foundNode.node.id}
        sidebarRootNodeId={foundNode.sidebar?.id}
        tabId={foundNode.currentTab?.id}
        productId={foundNode.currentProduct?.productId}
        productSlug={foundNode.currentProduct?.slug}
        versionId={foundNode.currentVersion?.versionId}
        versionSlug={foundNode.currentVersion?.slug}
        versionIsDefault={foundNode.isCurrentVersionDefault}
        productIsDefault={foundNode.isCurrentProductDefault}
      />
      <OriginalElementsProvider originalElements={initialOriginalElements}>
        {isUnsupportedNode ? (
          <UnsupportedContent>
            This page is not visible in the editor.
          </UnsupportedContent>
        ) : (
          <PageContents
            filename={initialFilename || foundNode.node.slug || "untitled"}
            initialHtml={initialHtml}
            initialFrontmatter={initialFrontmatter}
            initialOriginalElements={initialOriginalElements}
            initialOriginalFrontmatter={initialOriginalFrontmatter}
            clientNodeId={clientNodeId}
            serverData={serverData}
          />
        )}
      </OriginalElementsProvider>
    </>
  );
}
