import "server-only";

import { fetchPostmanCollection } from "./api";
import { getPostmanAccessToken } from "./jwt";
import { getOpenApiSpecByCollectionId } from "./openapi-repository";
import { getAppInstallationByTeamId } from "./repository";

export interface PostmanCollectionInfo {
    name: string;
    collectionId: string;
    teamName: string | null;
    teamDomain: string | null;
    workspaceId: string | null;
}

/**
 * Resolves a Postman collection ID to its human-readable name and URL metadata.
 *
 * Flow:
 * 1. Look up team_id and workspace_id from the postman_collection_openapi_specs table
 * 2. Get the Postman app installation for that team (includes team_domain)
 * 3. Get a Postman access token
 * 4. Fetch the collection details from the Postman API
 * 5. Return { name, collectionId, teamDomain, workspaceId }
 *
 * Returns undefined if any step fails (e.g., no spec record, no installation, API error).
 */
export async function getPostmanCollectionInfo(collectionId: string): Promise<PostmanCollectionInfo | undefined> {
    try {
        // Step 1: Look up the team_id and workspace_id from the openapi specs table
        const spec = await getOpenApiSpecByCollectionId(collectionId);
        if (!spec) {
            console.debug(`[getPostmanCollectionInfo] No spec found for collection ${collectionId}`);
            return undefined;
        }

        // Step 2: Get the app installation for the team
        const installation = await getAppInstallationByTeamId(spec.team_id);
        if (!installation) {
            console.debug(`[getPostmanCollectionInfo] No installation found for team ${spec.team_id}`);
            return undefined;
        }

        // Step 3: Get an access token
        const accessToken = await getPostmanAccessToken({
            teamId: spec.team_id,
            installationAuthId: installation.app_installation_id,
            sharedSecret: installation.shared_secret
        });

        // Step 4: Fetch the collection from Postman API
        const collection = await fetchPostmanCollection(accessToken, collectionId);

        // Step 5: Extract the name
        const info = collection.info as Record<string, unknown> | undefined;
        const name = info?.name;
        if (typeof name !== "string") {
            console.debug(`[getPostmanCollectionInfo] Collection ${collectionId} has no info.name`);
            return undefined;
        }

        return {
            name,
            collectionId,
            teamName: installation.team_name ?? null,
            teamDomain: installation.team_domain ?? null,
            workspaceId: spec.workspace_id ?? null
        };
    } catch (error) {
        console.error(`[getPostmanCollectionInfo] Failed to resolve info for collection ${collectionId}:`, error);
        return undefined;
    }
}
