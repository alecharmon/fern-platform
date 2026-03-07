"use server";

import { postToSlackImmediate } from "@fern-api/docs-server/slack";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import { buildSourceLine, slackLink } from "./notifyDocsOnboardingComplete.helpers";

interface NotifyDocsOnboardingCompleteResult {
    success: boolean;
    error?: string;
}

export async function notifyDocsOnboardingComplete({
    orgId,
    repoUrl,
    docsUrl,
    postmanCollectionId,
    sessionReplayUrl,
    dashboardUrl,
    initialReferrer,
    utmSource,
    utmMedium,
    utmCampaign
}: {
    orgId: string;
    repoUrl: string;
    docsUrl: string;
    postmanCollectionId?: string | null;
    sessionReplayUrl?: string | null;
    dashboardUrl?: string | null;
    initialReferrer?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
}): Promise<NotifyDocsOnboardingCompleteResult> {
    const session = await getCurrentSession();
    const userEmail = session?.user.email ?? "unknown";

    const sourceLine = `\nSource: ${buildSourceLine({ postmanCollectionId, initialReferrer, utmSource, utmMedium, utmCampaign })}`;
    const replayLine = sessionReplayUrl ? `\n<${sessionReplayUrl}|PostHog Session Replay>` : "";
    const dashboardLine = dashboardUrl ? `\nDashboard: ${slackLink(dashboardUrl)}` : "";
    const message = `*[${orgId}]* ${userEmail} just completed the docs onboarding!\nGitHub repo: ${slackLink(repoUrl)}\nDocs site: ${slackLink(docsUrl)}${dashboardLine}${sourceLine}${replayLine}`;

    const result = await postToSlackImmediate("#dashboard-ftux-notifs", message, "docs-onboarding-complete");

    if (!result.success) {
        console.error("Failed to send docs onboarding completion notification to Slack:", result.error);
        if (result.error === "no-token") {
            return { success: false, error: "Slack is not configured" };
        }
        return { success: false, error: "Failed to send notification" };
    }

    return { success: true };
}
