import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { logger } from "@fern-api/ui-core-utils/logger";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
    if (isLocal() || isSelfHosted()) {
        throw new Error("production deployment is only available in production");
    }

    logger.info(
        `[deployment-promoted] Revalidation is now handled by the revalidate-all-sites GitHub Actions workflow`
    );

    return new Response("OK", { status: 200 });
}
