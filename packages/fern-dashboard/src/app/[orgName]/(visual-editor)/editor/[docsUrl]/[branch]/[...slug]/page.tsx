import "server-only";

import { notFound, redirect } from "next/navigation";

import { createEditableDocsLoader } from "@fern-api/docs-loader";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId, getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import { mdxToHtml } from "@fern-docs/mdx";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { GitHubLoader } from "@/app/services/github/github-loader";
import { ROOT_SLUG_ALIAS, constructEditorSlug } from "@/utils/editor-routing";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

import PageNode from "./PageNode";

export const experimental_ppr = false;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{
    orgName: Auth0OrgName;
    docsUrl: EncodedDocsUrl;
    branch: string;
    slug: string[];
  }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { orgName, docsUrl, branch, slug: slugArray } = await params;

  const { githubUrl, session } = await assertAuthAndFetchGithubUrl({
    orgName,
    docsUrl: parseDocsUrlParam({ docsUrl }),
  });

  const resolvedSearchParams = await searchParams;
  const host = await getHostFromHeaders();
  const slugAlias = slugArray.join("/");

  const loader = await createEditableDocsLoader(
    host,
    docsUrl,
    session.accessToken,
    new GitHubLoader(githubUrl)
  );
  const root = await loader.getRoot();

  const slug = slugAlias === ROOT_SLUG_ALIAS ? root.slug : slugAlias;
  const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));
  // Check if client-node-id is passed as search param
  const clientNodeId = resolvedSearchParams["client-node-id"];
  // If the page is not found and client-node-id is not passed, redirect to appropriate page
  // For client pages, we allow not-found nodes as long as clientNodeId is provided
  if (foundNode.type !== "found" && !clientNodeId) {
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

  const pageId =
    foundNode.type === "found" ? getPageId(foundNode.node) : undefined;

  // For client pages, don't try to load server data
  const page =
    pageId && !clientNodeId ? await loader.getPage(pageId) : undefined;

  const filename = page?.filename;
  const mdx = page?.markdown;
  const cssConfig = page?.css; // Extract CSS configuration
  const rawMarkdown = page?.rawMarkdown;

  // Until sites are deployed with the version of FDR that supports rawMarkdown, we need to parse the markdown
  // from the server as a fallback.
  const { html, frontmatter, originalElements, originalFrontmatter } =
    rawMarkdown
      ? mdxToHtml(rawMarkdown, {
          treatAsCustomElement: ["code"],
          treatAsUnsupported: ["math"],
        })
      : mdx
        ? mdxToHtml(mdx, {
            treatAsCustomElement: ["code"],
            treatAsUnsupported: ["math"],
          })
        : {};
  return (
    // TODO: Currently, we are force-hiding the table of contents is within Visual Editor.
    // This is a temporary solution, as I anticipate we will want the TOC to be dynamic based
    // on the tiptap editor's content.
    <AbstractLayoutEvaluatorContent
      tableOfContents={[]}
      frontmatter={frontmatter}
    >
      <div className="flex w-full flex-col gap-2 py-12">
        <PageNode
          serializableFoundNode={
            foundNode.type === "found"
              ? {
                  type: foundNode.type,
                  node: foundNode.node,
                  sidebar: foundNode.sidebar,
                  currentTab: foundNode.currentTab,
                  currentProduct: foundNode.currentProduct,
                  currentVersion: foundNode.currentVersion,
                  isCurrentVersionDefault: foundNode.isCurrentVersionDefault,
                  isCurrentProductDefault: foundNode.isCurrentProductDefault,
                }
              : undefined
          }
          clientNodeId={clientNodeId as NodeId}
          initialFilename={filename}
          initialHtml={html}
          initialFrontmatter={frontmatter}
          initialOriginalElements={originalElements}
          initialOriginalFrontmatter={originalFrontmatter}
          cssConfig={cssConfig}
        />
      </div>
    </AbstractLayoutEvaluatorContent>
  );
}
