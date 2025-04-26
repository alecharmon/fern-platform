import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { isLocal } from "@/server/isLocal";
import { getDocsDomainEdge } from "@/server/xfernhost/edge";

export async function GET(req: NextRequest) {
  if (!isLocal()) {
    return NextResponse.json(
      {
        error:
          "local revalidation is not accessible outside of local development mode",
      },
      { status: 400 }
    );
  }

  try {
    // Revalidate the provided tag
    const domain = getDocsDomainEdge(req);
    revalidateTag(domain);

    return NextResponse.json({
      revalidated: true,
      domain,
      now: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "[revalidate-local] failed to revalidate",
        message: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
