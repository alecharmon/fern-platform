import { unstable_cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

import { uniqBy } from "es-toolkit/array";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { COOKIE_FERN_TOKEN, slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { isNonNullish } from "@fern-api/ui-core-utils";

import { generateHtml } from "@/app/utils";
import { getMarkdownForPath } from "@/server/getMarkdownForPath";
import { getSectionRoot } from "@/server/getSectionRoot";

export const maxDuration = 300; // 5 minutes timeout

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
  const { host, domain } = await props.params;

  const path = slugToHref(req.nextUrl.searchParams.get("slug") ?? "");

  const content = await getLlmsFullTxt(host, domain, path);

  const html = await generateHtml({
    host,
    domain,
    content,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "s-maxage=60",
    },
  });
}

async function getLlmsFullTxt(
  host: string,
  domain: string,
  path: string
): Promise<string> {
  "use cache";

  unstable_cacheTag(domain, "getLlmsFullTxt");

  const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

  const loader = await createCachedDocsLoader(host, domain, fernToken);

  const root = getSectionRoot(await loader.getRoot(), path);

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

  const markdowns = (
    await Promise.all(
      uniqBy(
        nodes,
        (a) => FernNavigation.getPageId(a) ?? a.canonicalSlug ?? a.slug
      ).map(async (node) => {
        const markdown = await getMarkdownForPath(node, loader);
        if (markdown == null) {
          return undefined;
        }
        return markdown.content;
      })
    )
  ).filter(isNonNullish);

  if (markdowns.length === 0) {
    console.error(`[llmsFull:${domain}] Markdown is empty`);
    notFound();
  }

  return markdowns.join("\n\n");
}
