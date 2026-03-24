import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";
import { getPostmanCollectionInfo } from "@/app/services/postman/getPostmanCollectionName";
import type { DocsUrl } from "@/utils/types";
import { DocsSiteAttribute } from "./DocsSiteAttribute";
import { PostmanCollectionLink } from "./PostmanCollectionLink";

interface PostmanCollectionProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

function buildPostmanCollectionUrl(teamDomain: string, workspaceId: string, collectionId: string): string {
    return `https://${teamDomain}.postman.co/workspace/${workspaceId}/collection/${collectionId}`;
}

/**
 * Async server component that fetches the Postman collection ID from FDR,
 * resolves it to a human-readable name via the Postman API, and renders
 * it as a DocsSiteAttribute matching the Source/FernCliVersion pattern.
 *
 * When team_domain and workspace_id are available, the collection name
 * is rendered as a clickable link to the Postman collection page.
 *
 * Returns null if:
 * - No session
 * - No postmanCollectionId on the docs site
 * - Failed to resolve the collection info
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

        const collectionInfo = await getPostmanCollectionInfo(collectionId);
        if (!collectionInfo) {
            return null;
        }

        const displayText = collectionInfo.teamName
            ? `${collectionInfo.teamName} / ${collectionInfo.name}`
            : collectionInfo.name;

        const postmanUrl =
            collectionInfo.teamDomain && collectionInfo.workspaceId
                ? buildPostmanCollectionUrl(collectionInfo.teamDomain, collectionInfo.workspaceId, collectionId)
                : undefined;

        return (
            <DocsSiteAttribute name="Postman collection">
                <PostmanCollectionLink displayText={displayText} href={postmanUrl} />
            </DocsSiteAttribute>
        );
    } catch (error) {
        console.error("[PostmanCollection] Failed to fetch collection info:", error);
        return null;
    }
}
