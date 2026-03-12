import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";

export function safeUrl(url: string | null | undefined): URL | undefined {
    if (url == null || url === "") {
        return undefined;
    }

    try {
        url = withDefaultProtocol(url);
        return new URL(url);
    } catch (e) {
        logger.error(`[safe-url] ${JSON.stringify(e)}`);
        return undefined;
    }
}
