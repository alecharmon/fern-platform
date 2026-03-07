/**
 * Strips protocol prefixes (https://, http://) and github.com/ from a URL for display,
 * while preserving the full URL as a Slack hyperlink.
 */
export function slackLink(url: string): string {
    const display = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "");
    return `<${url}|${display}>`;
}

/**
 * Builds a human-readable source/attribution line from onboarding context.
 */
export function buildSourceLine({
    postmanCollectionId,
    initialReferrer,
    utmSource,
    utmMedium,
    utmCampaign
}: {
    postmanCollectionId?: string | null;
    initialReferrer?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
}): string {
    const parts: string[] = [];

    if (postmanCollectionId) {
        parts.push(`*Postman* (collection ID: ${postmanCollectionId})`);
    } else {
        parts.push("Direct");
    }

    if (initialReferrer && initialReferrer !== "$direct" && initialReferrer !== "") {
        parts.push(`Referrer: ${initialReferrer}`);
    }

    const utmParts: string[] = [];
    if (utmSource) {
        utmParts.push(`source=${utmSource}`);
    }
    if (utmMedium) {
        utmParts.push(`medium=${utmMedium}`);
    }
    if (utmCampaign) {
        utmParts.push(`campaign=${utmCampaign}`);
    }
    if (utmParts.length > 0) {
        parts.push(`UTM: ${utmParts.join(", ")}`);
    }

    return parts.join(" | ");
}
