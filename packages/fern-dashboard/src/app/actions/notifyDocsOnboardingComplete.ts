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
    utmCampaign,
    location,
    initialLandingPage,
    docsSiteName,
    apiSpecFileNames,
    hasCustomLogo,
    hasCustomColor
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
    location?: string | null;
    initialLandingPage?: string | null;
    docsSiteName?: string | null;
    apiSpecFileNames?: string[];
    hasCustomLogo?: boolean;
    hasCustomColor?: boolean;
}): Promise<NotifyDocsOnboardingCompleteResult> {
    const session = await getCurrentSession();
    const userEmail = session?.user.email ?? "unknown";

    const referredFrom = initialReferrer && initialReferrer !== "$direct" ? initialReferrer : "$direct";
    const sourceLine = `\nSource: ${buildSourceLine({ postmanCollectionId, initialReferrer, utmSource, utmMedium, utmCampaign })}`;
    const replayLine = sessionReplayUrl ? `\n<${sessionReplayUrl}|Session Replay>` : "";
    const dashboardLine = dashboardUrl ? `\n<${dashboardUrl}|Dashboard>` : "";
    const locationLine = location ? `\n*Location:* ${location}` : "";
    const referredFromLine = `\n*Referred from:* ${referredFrom}`;
    const landingPageLine = initialLandingPage ? `\n*Landing page:* ${initialLandingPage}` : "";

    // Onboarding details from WizardFormData
    const siteNameLine = docsSiteName ? `\n*Site name:* ${docsSiteName}` : "";
    const specLine =
        apiSpecFileNames && apiSpecFileNames.length > 0 ? `\n*API specs:* ${apiSpecFileNames.join(", ")}` : "";
    const brandingParts: string[] = [];
    if (hasCustomLogo) {
        brandingParts.push("logo");
    }
    if (hasCustomColor) {
        brandingParts.push("color");
    }
    const brandingLine = brandingParts.length > 0 ? `\n*Custom branding:* ${brandingParts.join(", ")}` : "";

    const message = `*New site created*\n\n*Email:* ${userEmail}\n*Domain:* ${slackLink(docsUrl)}\n*Organization:* ${orgId}${locationLine}${referredFromLine}${landingPageLine}${siteNameLine}${specLine}${brandingLine}\nGitHub repo: ${slackLink(repoUrl)}${dashboardLine}${sourceLine}${replayLine}`;

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
