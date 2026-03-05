import { getPostmanAccessToken } from "@/app/services/postman/jwt";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";

function getPostmanFernIntegrationServiceBaseUrl(): string {
    return process.env.POSTMAN_FERN_INTEGRATION_SERVICE_URL ?? "https://api.getpostman.com";
}

interface NotifyPostmanDeletedParams {
    teamId: string;
    collectionId: string;
}

export async function notifyPostmanDeleted({ teamId, collectionId }: NotifyPostmanDeletedParams): Promise<void> {
    console.log(
        `[postman-notify] Attempting to notify Postman of doc deletion: teamId=${teamId}, collectionId=${collectionId}`
    );

    const installation = await getAppInstallationByTeamId(teamId);
    if (!installation) {
        console.error(`[postman-notify] No app installation found for team ${teamId}. Cannot notify Postman.`);
        throw new Error(`No app installation found for team ${teamId}`);
    }
    console.log(
        `[postman-notify] Found app installation for team ${teamId}: installationId=${installation.app_installation_id}`
    );

    const accessToken = await getPostmanAccessToken({
        teamId,
        installationAuthId: installation.app_installation_id,
        sharedSecret: installation.shared_secret
    });
    console.log("[postman-notify] Successfully obtained Postman access token");

    const baseUrl = getPostmanFernIntegrationServiceBaseUrl();
    const response = await fetch(`${baseUrl}/fern/docs`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            teamId,
            collectionId,
            generationStatus: "DELETED"
        })
    });

    if (!response.ok) {
        const body = await response.text();
        console.error(
            `[postman-notify] Failed to notify Postman of doc deletion: ${response.status} ${response.statusText} - ${body}`
        );
        throw new Error(`Failed to notify Postman of doc deletion: ${response.status} ${response.statusText}`);
    }

    console.log("[postman-notify] Successfully notified Postman of doc deletion");
}
