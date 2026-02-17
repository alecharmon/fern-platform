import { getPostmanFernIntegrationServiceClient } from "@/app/services/postman/getPostmanFernIntegrationServiceClient";
import { getPostmanAccessToken } from "@/app/services/postman/jwt";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";

interface PostmanNotificationParams {
    teamId: string;
    collectionId: string;
    siteUrl: string;
    success: boolean;
    error?: string;
}

async function sendPostmanSlackNotification({
    teamId,
    collectionId,
    siteUrl,
    success,
    error
}: PostmanNotificationParams): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL_DOCS_INCIDENTS;
    if (!webhookUrl) {
        console.warn("[postman-notify] SLACK_WEBHOOK_URL_DOCS_INCIDENTS not configured, skipping Slack notification");
        return;
    }

    const status = success ? "SUCCESS" : "FAILURE";
    const message = success
        ? `Postman Docs Publish Notification (${status})\n• Team ID: ${teamId}\n• Collection ID: ${collectionId}\n• Site URL: https://${siteUrl}\n• Notified Postman of successful docs publish.`
        : `Postman Docs Publish Notification (${status})\n• Team ID: ${teamId}\n• Collection ID: ${collectionId}\n• Site URL: https://${siteUrl}\n• Error: ${error ?? "Docs generation failed"}\n• Notified Postman of docs publish failure.`;

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message })
        });

        if (!response.ok) {
            console.error(
                `[postman-notify] Failed to send Slack notification: ${response.status} ${response.statusText}`
            );
        } else {
            console.log("[postman-notify] Slack notification sent successfully");
        }
    } catch (slackError) {
        console.error("[postman-notify] Error sending Slack notification:", slackError);
    }
}

export async function notifyPostman({
    teamId,
    collectionId,
    siteUrl,
    success,
    error
}: PostmanNotificationParams): Promise<void> {
    console.log(
        `[postman-notify] Attempting to notify Postman: teamId=${teamId}, collectionId=${collectionId}, siteUrl=${siteUrl}, success=${success}${error ? `, error=${error}` : ""}`
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

    const client = getPostmanFernIntegrationServiceClient({ token: accessToken });

    if (success) {
        console.log(`[postman-notify] Sending SUCCESS notification to Postman: publishedDocUrl=https://${siteUrl}`);
        await client.putFernDocs({
            teamId,
            collectionId,
            success: true,
            publishedDocUrl: `https://${siteUrl}`
        });
    } else {
        console.log(
            `[postman-notify] Sending FAILURE notification to Postman: error=${error ?? "Docs generation failed"}`
        );
        await client.putFernDocs({
            teamId,
            collectionId,
            success: false,
            error: error ?? "Docs generation failed"
        });
    }

    console.log("[postman-notify] Successfully notified Postman");

    await sendPostmanSlackNotification({ teamId, collectionId, siteUrl, success, error });
}
