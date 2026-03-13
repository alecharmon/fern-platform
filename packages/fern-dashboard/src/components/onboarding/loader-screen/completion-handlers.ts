import { notifyDocsOnboardingComplete } from "@/app/actions/notifyDocsOnboardingComplete";
import type { WizardFormData } from "@/providers/OnboardingProvider";
import { getOnboardingFormData, getOnboardingSession } from "@/utils/onboardingSession";
import { extractPosthogAttribution, getSessionReplayUrl } from "./posthog-utils";

/**
 * Links the GitHub repo to the docs site in FDR.
 * This needs to happen after the workflow completes because the docs URL
 * isn't registered in FDR until `fern generate --docs` runs.
 */
export async function linkRepoToDocsSite(publishUrl: string, repoUrl: string): Promise<void> {
    try {
        const linkResponse = await fetch("/api/onboarding-docs/link-repo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                docsUrl: publishUrl.replace("https://", ""),
                githubUrl: repoUrl
                // orgName intentionally omitted - looked up securely from FDR
            })
        });
        if (linkResponse.ok) {
            console.log("[LoaderScreen] Successfully linked repo to docs site");
        } else {
            console.error("[LoaderScreen] Failed to link repo:", await linkResponse.text());
        }
    } catch (linkError) {
        console.error("[LoaderScreen] Error linking repo:", linkError);
    }
}

/**
 * Registers the Postman collection ID with FDR so the docs site is linked.
 * `fern generate --docs` registers the site but doesn't pass postmanCollectionId,
 * so we do it here as a follow-up call.
 */
export async function registerPostmanCollection(
    publishUrl: string,
    orgName: string,
    postmanCollectionId: string
): Promise<void> {
    try {
        const domain = publishUrl.replace("https://", "");
        console.log(`[LoaderScreen] Registering postmanCollectionId=${postmanCollectionId} for domain=${domain}`);
        const registerResponse = await fetch("/api/onboarding-docs/register-postman-collection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                domain,
                orgId: orgName,
                postmanCollectionId
            })
        });
        if (registerResponse.ok) {
            console.log("[LoaderScreen] Successfully registered postmanCollectionId in FDR");
        } else {
            console.error("[LoaderScreen] Failed to register postmanCollectionId:", await registerResponse.text());
        }
    } catch (registerError) {
        console.error("[LoaderScreen] Error registering postmanCollectionId:", registerError);
    }
}

/**
 * Notifies Postman that the docs site was published successfully.
 */
export async function notifyPostman(
    publishUrl: string,
    postmanTeamId: string,
    postmanCollectionId: string
): Promise<void> {
    try {
        const siteUrl = publishUrl.replace("https://", "");
        console.log(
            `[LoaderScreen] Notifying Postman: teamId=${postmanTeamId}, collectionId=${postmanCollectionId}, siteUrl=${siteUrl}`
        );
        const notifyResponse = await fetch("/api/onboarding-docs/postman-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                teamId: postmanTeamId,
                collectionId: postmanCollectionId,
                siteUrl,
                generationStatus: "SUCCESS"
            })
        });
        if (notifyResponse.ok) {
            console.log("[LoaderScreen] Successfully notified Postman");
        } else {
            console.error("[LoaderScreen] Failed to notify Postman:", await notifyResponse.text());
        }
    } catch (notifyError) {
        console.error("[LoaderScreen] Error notifying Postman:", notifyError);
    }
}

/**
 * Sends a Slack notification about docs onboarding completion.
 * Gathers PostHog attribution data and calls the server action.
 */
export function sendSlackNotification(
    wizardFormData: WizardFormData,
    repoResult: { owner: string; githubRepoUrl: string },
    docsUrl: string | undefined
): void {
    const sessionData = getOnboardingSession();
    const sessionReplayUrl = getSessionReplayUrl();
    const attribution = extractPosthogAttribution();

    // Build the dashboard URL from the docs URL
    let onboardingDashboardUrl: string | null = null;
    if (docsUrl) {
        try {
            const cleanedUrl = new URL(docsUrl);
            const orgForDashboard = sessionData?.orgName ?? repoResult.owner;
            onboardingDashboardUrl = `https://dashboard.buildwithfern.com/${orgForDashboard}/docs/${cleanedUrl.host}`;
        } catch {
            // ignore URL parsing errors
        }
    }

    notifyDocsOnboardingComplete({
        orgId: sessionData?.orgName ?? repoResult.owner,
        repoUrl: repoResult.githubRepoUrl,
        docsUrl: docsUrl ?? "",
        postmanCollectionId: wizardFormData.postmanCollectionId,
        sessionReplayUrl,
        dashboardUrl: onboardingDashboardUrl,
        initialReferrer: attribution.initialReferrer,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        location: attribution.userLocation,
        initialLandingPage: attribution.initialLandingPage,
        docsSiteName: wizardFormData.docsSiteName || null,
        apiSpecFileNames: wizardFormData.openApiSpecUrls.map((s) => s.fileName),
        hasCustomLogo: !!(wizardFormData.logoFile || wizardFormData.logoUrl),
        hasCustomColor: !!(wizardFormData.primaryColorHex && wizardFormData.primaryColorHex !== "#008700")
    }).catch((err) => {
        console.error("[LoaderScreen] Failed to send Slack notification:", err);
    });
}

/**
 * Runs all post-completion side effects after a successful workflow.
 */
export async function handleWorkflowSuccess(
    publishUrl: string,
    orgName: string,
    repoUrl: string,
    hasLinkedRepo: boolean
): Promise<void> {
    const formData = getOnboardingFormData();

    // Link the GitHub repo to the docs site
    if (!hasLinkedRepo) {
        await linkRepoToDocsSite(publishUrl, repoUrl);
    }

    // Register Postman collection if applicable
    if (formData?.postmanCollectionId) {
        await registerPostmanCollection(publishUrl, orgName, formData.postmanCollectionId);
    }

    // Notify Postman if applicable
    if (formData?.postmanCollectionId && formData.postmanTeamId) {
        await notifyPostman(publishUrl, formData.postmanTeamId, formData.postmanCollectionId);
    }
}
