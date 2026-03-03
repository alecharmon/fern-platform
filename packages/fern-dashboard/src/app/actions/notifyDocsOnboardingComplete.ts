"use server";

import { postToSlackImmediate } from "@fern-api/docs-server/slack";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

interface NotifyDocsOnboardingCompleteResult {
    success: boolean;
    error?: string;
}

export async function notifyDocsOnboardingComplete({
    orgId,
    repoUrl,
    docsUrl,
    postmanCollectionId
}: {
    orgId: string;
    repoUrl: string;
    docsUrl: string;
    postmanCollectionId?: string | null;
}): Promise<NotifyDocsOnboardingCompleteResult> {
    const session = await getCurrentSession();
    const userEmail = session?.user.email ?? "unknown";

    const postmanLine = postmanCollectionId ? `\nPostman collection ID: ${postmanCollectionId}` : "";
    const message = `*[${orgId}]* ${userEmail} just completed the docs onboarding!\nGitHub repo: ${repoUrl}\nDocs site: ${docsUrl}${postmanLine}`;

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
