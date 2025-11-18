import { FdrLambda, fdrLambdaClient } from "../config/clients";
import { logger } from "../config/logger";
import { withoutStaging } from "../utils/withoutStaging";

/**
 * Fetch documentation metadata from FDR Lambda
 */
export async function getDocsUrlMetadata(domain: string): Promise<{
    url: string;
    org: string;
    isPreview: boolean;
    enableAlgoliaOnPreview: boolean;
} | null> {
    try {
        if (domain.includes("[") || domain.includes("%5B")) {
            logger.error("Cannot get docs url metadata for an invalid domain", { domain });
            return null;
        }

        const response = await fdrLambdaClient.docs.v2.read.getDocsUrlMetadata({
            url: FdrLambda.Url(withoutStaging(domain))
        });

        if (!response.ok) {
            logger.error("Failed to get docs url metadata", {
                domain: withoutStaging(domain),
                error: response.error
            });
            return null;
        }

        return {
            url: response.body.url,
            org: response.body.org,
            isPreview: response.body.isPreviewUrl,
            enableAlgoliaOnPreview: response.body.enableAlgoliaOnPreview
        };
    } catch (error) {
        logger.error("Failed to get docs url metadata", {
            domain: withoutStaging(domain),
            error
        });
        return null;
    }
}
