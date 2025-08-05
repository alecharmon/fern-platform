import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { MARKDOWN_PATTERN } from "@fern-api/docs-server/patterns";
import { removeLeadingSlash } from "@fern-api/docs-utils";
import { RoleId } from "@fern-api/fdr-sdk/navigation";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";

import {
  getMarkdownForPath,
  getPageNodeForPath,
} from "@/server/getMarkdownForPath";

/**
 * This endpoint returns the markdown content of any page in the docs by adding `.md` or `.mdx` to the end of any docs page.
 */

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
  if (isLocal()) {
    return new NextResponse(".md preview is not available in local preview", {
      status: 400,
    });
  }

  const { host, domain } = await props.params;

  const authEdgeConfig = await getAuthEdgeConfig(domain);
  const cookieJar = await cookies();
  const fern_token_cookie = cookieJar.get("fern_token")?.value;
  const fernUser = await safeVerifyFernJWTConfig(
    fern_token_cookie,
    authEdgeConfig
  );

  const path = req.nextUrl.pathname;
  const slug = path.replace(MARKDOWN_PATTERN, "");
  const cleanSlug = removeLeadingSlash(slug);

  const loader = await createCachedDocsLoader(host, domain);
  const node = getPageNodeForPath(await loader.getRoot(), cleanSlug);

  if (node == null) {
    console.error(`[${domain}] Node not found: ${path}`);
    notFound();
  }

  // if the page is authed, but the user is not authed, return a 403
  if ((node.authed && !fernUser) || !fernUser?.roles) {
    return new NextResponse(null, { status: 403 });
  }

  // if the page is authed and user has insufficient permissions, return a 403
  if (
    node.authed &&
    !canView({ userRoles: fernUser.roles, pageViewers: node.viewers })
  ) {
    return new NextResponse(null, { status: 403 });
  }

  const markdown = await getMarkdownForPath(node, loader);
  if (markdown == null) {
    console.error(`[${domain}] Markdown not found: ${path}`);
    notFound();
  }

  return new NextResponse(markdown.content, {
    status: 200,
    headers: {
      "Content-Type": `text/${markdown.contentType}`,
      "X-Robots-Tag": "noindex", // prevent search engines from indexing this page
      "Cache-Control": "s-maxage=60", // cannot guarantee that the content won't change, so we only cache for 60 seconds
    },
  });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "X-Robots-Tag": "noindex",
      Allow: "OPTIONS, GET",
    },
  });
}

// if a user is logged in, returns whether they have permissions to view a page
function canView({
  userRoles,
  pageViewers,
}: {
  userRoles: string[] | undefined;
  pageViewers: RoleId[] | undefined;
}): boolean {
  // if there is no roles field in the payload, the user should not be authenticated
  if (!userRoles) {
    return false;
  }

  // if no page viewers are defined but the user is logged in, page is visible
  if (!pageViewers || pageViewers.includes(RoleId("everyone"))) {
    return true;
  }

  return userRoles.some((role) => pageViewers.includes(RoleId(role)));
}
