import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
  const { host, domain } = await props.params;

  const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

  try {
    const loader = await createCachedDocsLoader(host, domain, fernToken);
    const [config, files] = await Promise.all([
      loader.getConfig(),
      loader.getFiles(),
    ]);

    if (config.favicon) {
      const faviconUrl = files[config.favicon]?.src;

      if (!faviconUrl) {
        return new NextResponse(null, { status: 404 });
      }

      const faviconResponse = await fetch(faviconUrl);

      if (faviconResponse.ok) {
        const faviconBuffer = await faviconResponse.arrayBuffer();

        return new NextResponse(faviconBuffer, {
          status: 200,
          headers: {
            "Content-Type":
              faviconResponse.headers.get("Content-Type") || "image/x-icon",
            "Cache-Control": "public, max-age=31536000",
          },
        });
      }
    }

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    console.error(`[favicon:${domain}] Error serving favicon:`, error);
    return new NextResponse(null, { status: 404 });
  }
}
