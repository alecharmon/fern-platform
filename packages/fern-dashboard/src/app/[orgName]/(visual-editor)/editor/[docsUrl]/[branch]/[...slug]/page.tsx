import { notFound, redirect } from "next/navigation";

import { createEditableDocsLoader } from "@fern-api/docs-loader";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { mdxToHtml } from "@fern-docs/mdx";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { UnsupportedContent } from "@/components/editor/UnsupportedContent";
import { OriginalElementsProvider } from "@/providers/OriginalElementsContext";
import { ROOT_SLUG_ALIAS, constructEditorSlug } from "@/utils/editor-routing";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { EncodedDocsUrl } from "@/utils/types";

import PageContents from "./PageContents";

export const experimental_ppr = false;

export default async function Page({
  params,
}: {
  params: Promise<{
    orgName: Auth0OrgName;
    docsUrl: EncodedDocsUrl;
    branch: string;
    slug: string[];
  }>;
}) {
  const session = await getCurrentSession();

  if (session == null) {
    redirect("/");
  }

  const { orgName, docsUrl, branch, slug: slugArray } = await params;
  const host = await getHostFromHeaders();
  const slugAlias = slugArray.join("/");

  const loader = await createEditableDocsLoader(
    host,
    docsUrl,
    session?.accessToken
  );
  const root = await loader.getRoot();

  const slug = slugAlias === ROOT_SLUG_ALIAS ? root.slug : slugAlias;
  const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));

  // If the page is not found, redirect to the root (index) page
  if (foundNode.type !== "found") {
    if (foundNode.redirect) {
      redirect(
        constructEditorSlug({
          orgName,
          docsUrl,
          branchName: branch,
          slug: foundNode.redirect,
        })
      );
    }
    if (slug === root.slug) {
      // TODO: fix this so that we can redirect to the root page. right now, the root slug is not always the
      // root page. (e.g. elevenlabs' root == "/docs" but the root page is "/docs/overview")
      notFound();
    }
    // only redirect to root if the slug is not the root slug, otherwise we'll get a redirect loop
    redirect(
      constructEditorSlug({
        orgName,
        docsUrl,
        branchName: branch,
        slug: ROOT_SLUG_ALIAS,
      })
    );
  }

  const pageId = getPageId(foundNode.node);

  const page = pageId && (await loader.getPage(pageId));
  const mdx = page?.markdown ?? "";
  const { html, frontmatter, originalElements, originalFrontmatter } =
    mdxToHtml(mdx, {
      treatAsCustomElement: ["code"],
      treatAsUnsupported: ["math"],
    });

  return (
    // TODO: Currently, we are force-hiding the table of contents is within Visual Editor.
    // This is a temporary solution, as I anticipate we will want the TOC to be dynamic based
    // on the tiptap editor's content.
    <AbstractLayoutEvaluatorContent
      tableOfContents={[]}
      frontmatter={frontmatter}
    >
      <div className="flex w-full flex-col gap-2 py-12">
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
        {foundNode.node.type !== "page" && foundNode.node.type !== "section" ? (
          <UnsupportedContent>
            This page is not visible in the editor.
          </UnsupportedContent>
        ) : (
          <OriginalElementsProvider originalElements={originalElements}>
            <PageContents
              // TODO: If there is no filename, it is an error we should surface
              filename={page?.filename ?? ""}
              initialHtml={html}
              initialFrontmatter={frontmatter}
              initialOriginalElements={originalElements}
              initialOriginalFrontmatter={originalFrontmatter}
            />
          </OriginalElementsProvider>
        )}
      </div>
    </AbstractLayoutEvaluatorContent>
  );
}
