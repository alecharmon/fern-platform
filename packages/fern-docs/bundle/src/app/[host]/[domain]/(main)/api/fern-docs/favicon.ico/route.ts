import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { COOKIE_FERN_TOKEN, FERN_DOCS_ORIGINS } from "@fern-api/docs-utils";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;

    const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;
    const isPreview = process.env.VERCEL_ENV === "preview";

    try {
        const loader = await createCachedDocsLoader(host, domain, fernToken);
        const [config, files] = await Promise.all([loader.getConfig(), loader.getFiles()]);

        if (config.favicon) {
            const faviconUrl = files[config.favicon]?.src;

            if (!faviconUrl) {
                if (isPreview) {
                    return new NextResponse(null, { status: 204 });
                }
                return new NextResponse(null, { status: 404 });
            }

            const faviconResponse = await fetch(faviconUrl);

            if (faviconResponse.ok) {
                const faviconBuffer = await faviconResponse.arrayBuffer();

                // Disable caching for FERN_DOCS_ORIGINS hosts and localhost:3000
                const isFernDocsOrigin = FERN_DOCS_ORIGINS.includes(host);
                const isLocalhost = host === "localhost:3000";
                const cacheControl =
                    isFernDocsOrigin || isLocalhost
                        ? "no-cache, no-store, must-revalidate"
                        : "public, max-age=31536000";

                console.log(`[favicon:${domain}] Host: ${host}, Cache-Control: ${cacheControl}`, {
                    isFernDocsOrigin,
                    isLocalhost
                });

                return new NextResponse(faviconBuffer, {
                    status: 200,
                    headers: {
                        "Content-Type": faviconResponse.headers.get("Content-Type") || "image/x-icon",
                        "Cache-Control": cacheControl
                    }
                });
            }
        }

        if (isPreview) {
            return new NextResponse(null, { status: 204 });
        }
        return new NextResponse(null, { status: 404 });
    } catch (error) {
        console.error(`[favicon:${domain}] Error serving favicon:`, error);
        if (isPreview) {
            return new NextResponse(null, { status: 204 });
        }
        return new NextResponse(null, { status: 404 });
    }
}
