"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConfirmScreen } from "@/components/onboarding/ConfirmScreen";
import { generateOrgIdFromDocsUrl } from "@/components/onboarding/utils";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { getOnboardingFormData, getSitePublishUrl } from "@/utils/onboardingSession";

interface CompleteStepClientProps {
    organizationId?: string;
}

export function CompleteStepClient({ organizationId }: CompleteStepClientProps) {
    const { formData, form } = useOnboarding();
    const router = useRouter();

    // Safeguard: check formData first, then fallback to sessionStorage
    useEffect(() => {
        if (!formData.sitePublishUrl) {
            // Try to restore from sessionStorage (in case of page refresh)
            const savedPublishUrl = getSitePublishUrl();
            const savedFormData = getOnboardingFormData();

            if (savedPublishUrl && savedFormData) {
                console.log("[CompleteStepClient] Restoring form data from sessionStorage");
                // Restore the full form data
                Object.entries(savedFormData).forEach(([key, value]) => {
                    form.setFieldValue(key as keyof typeof savedFormData, value);
                });
                // Ensure sitePublishUrl is set
                form.setFieldValue("sitePublishUrl", savedPublishUrl);
            } else {
                console.warn("[CompleteStepClient] No sitePublishUrl found, redirecting to start");
                router.replace("/get-started/docs");
            }
        }
    }, [formData.sitePublishUrl, form, router]);

    // Don't render until we've verified completion state
    if (!formData.sitePublishUrl) {
        return null;
    }

    // Generate orgName from docs URL if not provided
    const effectiveOrgName = organizationId || generateOrgIdFromDocsUrl(formData.docsSiteUrl);

    return <ConfirmScreen orgName={effectiveOrgName} docsUrl={formData.docsSiteUrl} wizardFormData={formData} />;
}
