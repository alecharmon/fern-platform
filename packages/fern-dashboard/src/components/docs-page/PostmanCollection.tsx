import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";
import { getPostmanCollectionName } from "@/app/services/postman/getPostmanCollectionName";
import type { DocsUrl } from "@/utils/types";
import { PostmanLogoClassic } from "../auth/PostmanLogoClassic";
import { DocsSiteAttribute } from "./DocsSiteAttribute";

interface PostmanCollectionProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

/**
 * Async server component that fetches the Postman collection ID from FDR,
 * resolves it to a human-readable name via the Postman API, and renders
 * it as a DocsSiteAttribute matching the Source/FernCliVersion pattern.
 *
 * Returns null if:
 * - No session
 * - No postmanCollectionId on the docs site
 * - Failed to resolve the collection name
 */
export async function PostmanCollection({ docsUrl, orgName }: PostmanCollectionProps) {
    const session = await getCurrentSession();
    if (!session) {
        return null;
    }

    try {
        const { docsDeployment } = getOrpcFdrClient({ token: session.accessToken });
        const result = await docsDeployment.getPostmanCollectionId({
            orgId: orgName,
            domain: docsUrl
        });

        const collectionId = result.postmanCollectionId;
        if (!collectionId) {
            return null;
        }

        const collectionName = await getPostmanCollectionName(collectionId);
        if (!collectionName) {
            return null;
        }

        return (
            <DocsSiteAttribute name="Postman collection">
                <div className="flex min-w-0 items-center gap-2">
                    <div className="shrink-0">
                        <PostmanLogoClassic />
                    </div>
                    <span className="min-w-0 truncate">{collectionName}</span>
                </div>
            </DocsSiteAttribute>
        );
    } catch (error) {
        console.error("[PostmanCollection] Failed to fetch collection info:", error);
        return null;
    }
}
