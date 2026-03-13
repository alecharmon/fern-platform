import jwt from "jsonwebtoken";

import { getPostmanFernIntegrationServiceClient } from "@/app/services/postman/getPostmanFernIntegrationServiceClient";
import { getPostmanAccessToken } from "@/app/services/postman/jwt";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";
import { fernCliConfig } from "@/utils/fernCliConfig";

const PROD_DOCS_DOMAIN = "docs.buildwithfern.com";
const DEV_DOCS_DOMAIN = "docs.dev.buildwithfern.com";
const PROD_DASHBOARD_BASE_URL = "https://dashboard.buildwithfern.com";
const DEV_DASHBOARD_BASE_URL = "https://dashboard-dev.buildwithfern.com";

function normalizeSiteUrl(siteUrl: string): string {
    if (siteUrl.includes(DEV_DOCS_DOMAIN)) {
        return siteUrl.replace(DEV_DOCS_DOMAIN, fernCliConfig.docsDomain);
    }
    if (siteUrl.includes(PROD_DOCS_DOMAIN)) {
        return siteUrl.replace(PROD_DOCS_DOMAIN, fernCliConfig.docsDomain);
    }
    return siteUrl;
}

function buildEditDocUrl({
    docsUrl,
    postmanTeamId,
    sharedSecret
}: {
    docsUrl: string;
    postmanTeamId: string;
    sharedSecret: string;
}): string {
    const token = jwt.sign({ postmanTeamId, intent: "edit" }, sharedSecret, { algorithm: "HS256" });
    const encodedDocsUrl = encodeURIComponent(docsUrl);
    const dashboardBaseUrl = getDashboardBaseUrl();
    return `${dashboardBaseUrl}/view/${encodedDocsUrl}?token=${token}`;
}

function getDashboardBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_FERN_CLI_ENV === "dev" || process.env.FERN_CLI_ENV === "dev") {
        return DEV_DASHBOARD_BASE_URL;
    }
    return PROD_DASHBOARD_BASE_URL;
}

type GenerationStatus = "SUCCESS" | "FAILED";

interface PostmanNotificationParams {
    teamId: string;
    collectionId: string;
    siteUrl: string;
    generationStatus: GenerationStatus;
    error?: string;
}

async function sendPostmanSlackNotification({
    teamId,
    collectionId,
    siteUrl,
    generationStatus,
    error
}: PostmanNotificationParams): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL_DOCS_INCIDENTS;
    if (!webhookUrl) {
        console.warn("[postman-notify] SLACK_WEBHOOK_URL_DOCS_INCIDENTS not configured, skipping Slack notification");
        return;
    }

    const message =
        generationStatus === "SUCCESS"
            ? `Postman Docs Publish Notification (${generationStatus})\n• Team ID: ${teamId}\n• Collection ID: ${collectionId}\n• Site URL: https://${siteUrl}\n• Notified Postman of successful docs publish.`
            : `Postman Docs Publish Notification (${generationStatus})\n• Team ID: ${teamId}\n• Collection ID: ${collectionId}\n• Site URL: https://${siteUrl}\n• Error: ${error ?? "Docs generation failed"}\n• Notified Postman of docs publish failure.`;

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
    generationStatus,
    error
}: PostmanNotificationParams): Promise<void> {
    const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
    console.log(
        `[postman-notify] Attempting to notify Postman: teamId=${teamId}, collectionId=${collectionId}, siteUrl=${normalizedSiteUrl} (original: ${siteUrl}), generationStatus=${generationStatus}${error ? `, error=${error}` : ""}`
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

    if (generationStatus === "SUCCESS") {
        const editDocUrl = buildEditDocUrl({
            docsUrl: normalizedSiteUrl,
            postmanTeamId: teamId,
            sharedSecret: installation.shared_secret
        });
        console.log(
            `[postman-notify] Sending SUCCESS notification to Postman: publishedDocUrl=https://${normalizedSiteUrl}, editDocUrl=${editDocUrl}`
        );
        await client.putFernDocs({
            teamId,
            collectionId,
            generationStatus: "SUCCESS",
            publishedDocUrl: `https://${normalizedSiteUrl}`,
            editDocUrl
        } as Parameters<typeof client.putFernDocs>[0]);
    } else {
        console.log(
            `[postman-notify] Sending FAILED notification to Postman: error=${error ?? "Docs generation failed"}`
        );
        await client.putFernDocs({
            teamId,
            collectionId,
            generationStatus: "FAILED",
            error: error ?? "Docs generation failed"
        } as Parameters<typeof client.putFernDocs>[0]);
    }

    console.log("[postman-notify] Successfully notified Postman");

    await sendPostmanSlackNotification({ teamId, collectionId, siteUrl: normalizedSiteUrl, generationStatus, error });
}
