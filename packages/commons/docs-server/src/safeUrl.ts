import { withDefaultProtocol } from "@fern-api/ui-core-utils";

export function safeUrl(url: string | null | undefined): URL | undefined {
    if (url == null || url === "") {
        return undefined;
    }

    try {
        url = withDefaultProtocol(url);
        return new URL(url);
    } catch (e) {
        console.error(`[safe-url] ${JSON.stringify(e)}`);
        return undefined;
    }
}
