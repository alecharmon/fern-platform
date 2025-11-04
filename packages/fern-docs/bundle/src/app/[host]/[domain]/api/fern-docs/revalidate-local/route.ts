import { isLocal } from "@fern-api/docs-server/isLocal";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    if (!isLocal()) {
        return NextResponse.json(
            {
                error: "local revalidation is not accessible outside of local development mode"
            },
            { status: 400 }
        );
    }

    try {
        // Revalidate the provided tag
        const domain = getDocsDomainEdge(req);
        revalidateTag(domain);

        // Also revalidate all paths to clear the Full Route Cache
        // This is necessary because revalidateTag() only clears unstable_cache,
        // but doesn't clear the cached RSC payloads that Next.js serves to router.refresh()
        revalidatePath("/", "layout");

        return NextResponse.json({
            revalidated: true,
            domain,
            now: Date.now()
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: "[revalidate-local] failed to revalidate",
                message: error instanceof Error ? error.message : "unknown error"
            },
            { status: 500 }
        );
    }
}
