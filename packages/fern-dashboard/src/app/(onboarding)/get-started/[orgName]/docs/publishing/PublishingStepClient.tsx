"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect } from "react";
import { LoaderScreen } from "@/components/onboarding/LoaderScreen";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { getOnboardingFormData, getOnboardingSession, saveSitePublishUrl } from "@/utils/onboardingSession";

/**
 * Publishing step client component
 *
 * This is a strictly guarded intermediate step that can only be accessed
 * after submitting the details form. It shows the loader screen while
 * docs are being generated and published.
 *
 * Guards:
 * - Requires valid sessionStorage data (sessionId, orgName, formData)
 * - Redirects to details page if data is missing or expired
 * - No back arrow or onboarding step card UI
 */
interface PublishingStepClientProps {
    organizationId: string;
}

export function PublishingStepClient({ organizationId }: PublishingStepClientProps) {
    const router = useRouter();
    const { form, goToNextStep } = useOnboarding();
    const posthog = usePostHog();

    // Check for required session data and redirect if missing
    const sessionData = getOnboardingSession();
    const formData = getOnboardingFormData();

    useEffect(() => {
        if (!sessionData || !formData) {
            console.warn("[PublishingStepClient] No valid session data found, redirecting to details");
            const targetOrg = sessionData?.orgName ?? organizationId;
            if (targetOrg) {
                router.replace(`/get-started/${targetOrg}/docs/details`);
            } else {
                router.replace("/get-started");
            }
        }
    }, [formData, organizationId, router, sessionData]);

    const handleStreamComplete = useCallback(
        (result: { url: string; fernDocsDownloadUrl?: string; githubRepoUrl?: string }) => {
            const formData = getOnboardingFormData();

            // Track successful docs site creation
            captureEvent(posthog, PosthogEventName.ONBOARDING_DOCS_SITE_CREATED, {
                docsSiteUrl: formData?.docsSiteUrl ?? "",
                sitePublishUrl: result.url
            });

            // Store the published URL in form state to enable access to complete page
            form.setFieldValue("sitePublishUrl", result.url);

            // Save the published URL to sessionStorage so it persists across refreshes
            saveSitePublishUrl(result.url);

            // Note: We don't clear sessionStorage here because the complete page needs it
            // The session data will expire after 1 hour automatically

            // Navigate to completion screen
            setTimeout(() => {
                goToNextStep();
            }, 100);
        },
        [goToNextStep, form, posthog]
    );

    // Get session data
    // Don't render until we've verified session data exists
    if (!sessionData || !formData) {
        return null;
    }

    return (
        <div className="flex w-full flex-1 items-center justify-center">
            <LoaderScreen
                wizardFormData={formData}
                orgName={sessionData.orgName}
                showLogs={true}
                sessionId={sessionData.sessionId}
                onComplete={handleStreamComplete}
            />
        </div>
    );
}
