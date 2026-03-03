"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect } from "react";
import { LoaderScreen } from "@/components/onboarding/LoaderScreen";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { getOnboardingFormData, getOnboardingSession } from "@/utils/onboardingSession";

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
    const { form, formData: providerFormData } = useOnboarding();
    const posthog = usePostHog();

    // Check for required session data
    // Prefer providerFormData (React context) because it preserves File objects
    // storedFormData (sessionStorage) loses File objects during JSON serialization
    const sessionData = getOnboardingSession();
    const storedFormData = getOnboardingFormData();

    // Merge: use provider data for File objects, stored data for other fields
    // For openApiSpecUrls: prefer provider if non-empty, fall back to stored data
    // (provider resets to [] on remount, but stored data preserves the uploaded URLs)
    const providerSpecUrls = providerFormData?.openApiSpecUrls ?? [];
    const storedSpecUrls = storedFormData?.openApiSpecUrls ?? [];
    const mergedSpecUrls = providerSpecUrls.length > 0 ? providerSpecUrls : storedSpecUrls;

    const formData = providerFormData?.docsSiteName
        ? {
              ...storedFormData,
              ...providerFormData,
              // Ensure File objects from provider are used (not the empty arrays from storage)
              openApiSpecFiles: providerFormData.openApiSpecFiles ?? [],
              openApiSpecUrls: mergedSpecUrls,
              logoFile: providerFormData.logoFile,
              faviconFile: providerFormData.faviconFile
          }
        : storedFormData;

    useEffect(() => {
        // Only redirect if we have no form data at all
        if (!formData?.docsSiteName) {
            console.warn("[PublishingStepClient] No valid form data found, redirecting to details");
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
                sitePublishUrl: result.url,
                postmanCollectionId: formData?.postmanCollectionId
            });

            // Store the published URL in form state
            form.setFieldValue("sitePublishUrl", result.url);

            // Publishing page is the final landing page - no navigation needed
            // The LoaderScreen will update its UI to show completion state
        },
        [form, posthog]
    );

    // Don't render until we've verified form data exists
    if (!formData?.docsSiteName) {
        return null;
    }

    // Use orgName from session data or fall back to URL param
    const orgName = sessionData?.orgName ?? organizationId;

    return (
        <div className="flex w-full flex-1 items-center justify-center">
            <LoaderScreen wizardFormData={formData} orgName={orgName} onComplete={handleStreamComplete} />
        </div>
    );
}
