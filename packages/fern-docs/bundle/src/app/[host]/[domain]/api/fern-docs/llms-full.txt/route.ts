import { unstable_cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

import { uniqBy } from "es-toolkit/array";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { COOKIE_FERN_TOKEN, slugToHref } from "@fern-api/docs-utils";
import { isLikelyBrowser } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { isNonNullish } from "@fern-api/ui-core-utils";

import { getMarkdownForPath } from "@/server/getMarkdownForPath";
import { getSectionRoot } from "@/server/getSectionRoot";

export const maxDuration = 300; // 5 minutes timeout

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
  const { host, domain } = await props.params;

  const path = slugToHref(req.nextUrl.searchParams.get("slug") ?? "");

  const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

  const { content, timingStats } = await getLlmsFullTxt(
    host,
    domain,
    path,
    fernToken
  );

  const userAgent = req.headers.get("user-agent");
  const possibleBot = !isLikelyBrowser(userAgent);

  track("static_content_served", {
    domain,
    host,
    path,
    contentLength: content.length,
    loadTimeMs: Math.round(timingStats.loadTimeMs),
    rootRetrievalMs: Math.round(timingStats.rootRetrievalMs),
    markdownProcessingMs: Math.round(timingStats.markdownProcessingMs),
    possibleBot,
    staticContentType: "llms-full.txt",
  });

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "s-maxage=60",
    },
  });
}

async function getLlmsFullTxt(
  host: string,
  domain: string,
  path: string,
  fernToken: string | undefined
): Promise<{ content: string; timingStats: any }> {
  "use cache";

  const startTime = performance.now();
  unstable_cacheTag(domain, "getLlmsFullTxt");

  const loader = await createCachedDocsLoader(host, domain, fernToken);

  const rootStartTime = performance.now();
  const root = getSectionRoot(await loader.getRoot(), path);
  const rootEndTime = performance.now();

  if (root == null) {
    console.error(`[llmsFull:${domain}] Could not find root`);
    notFound();
  }

  const nodes: FernNavigation.NavigationNodePage[] = [];

  FernNavigation.traverseDF(root, (node) => {
    if (FernNavigation.hasMetadata(node)) {
      if (node.hidden || node.authed) {
        return SKIP;
      }
    }

    if (FernNavigation.isPage(node)) {
      nodes.push(node);
    }

    return CONTINUE;
  });

  const markdownStartTime = performance.now();
  const markdowns = (
    await Promise.all(
      uniqBy(
        nodes,
        (a) => FernNavigation.getPageId(a) ?? a.canonicalSlug ?? a.slug
      ).map(async (node) => {
        const markdown = await getMarkdownForPath(node, loader, domain);
        if (markdown == null) {
          return undefined;
        }
        return markdown.content;
      })
    )
  ).filter(isNonNullish);
  const markdownEndTime = performance.now();

  if (markdowns.length === 0) {
    console.error(`[llmsFull:${domain}] Markdown is empty`);
    track("llms_full_txt_empty_content", {
      domain,
      host,
      path,
    });
    notFound();
  }

  const totalTime = performance.now() - startTime;

  return {
    content: markdowns.join("\n\n"),
    timingStats: {
      loadTimeMs: totalTime,
      rootRetrievalMs: rootEndTime - rootStartTime,
      markdownProcessingMs: markdownEndTime - markdownStartTime,
    },
  };
}
