import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
    const host = req.nextUrl.host;
    const domain = getDocsDomainEdge(req);
    const pathname = req.nextUrl.searchParams.get("path");
    if (pathname == null) {
        return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    revalidatePath(`/${host}/${domain}/${slugjoin(pathname)}`);
    return NextResponse.json({ success: true });
}
