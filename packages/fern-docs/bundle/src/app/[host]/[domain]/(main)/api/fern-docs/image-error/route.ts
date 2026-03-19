import { track } from "@fern-api/docs-server";
import { logger } from "@fern-api/ui-core-utils/logger";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    try {
        const { domain } = await props.params;
        const body = await req.json();

        const { src, error, url } = body as {
            src?: string;
            error?: string;
            url?: string;
        };

        if (!src) {
            return NextResponse.json({ error: "Missing src" }, { status: 400 });
        }

        logger.warn(`[image-error] domain=${domain} src=${src} error=${error} url=${url}`);

        track("asset_error", {
            type: "image_load_error",
            domain,
            src,
            error: error ?? "unknown",
            pageUrl: url
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        logger.error("[image-error] Failed to process request:", e);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
