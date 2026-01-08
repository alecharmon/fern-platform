"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConfirmScreen } from "@/components/onboarding/ConfirmScreen";
import { generateOrgIdFromDocsUrl } from "@/components/onboarding/utils";
import { useOnboarding } from "@/providers/OnboardingProvider";

interface CompleteStepClientProps {
    organizationId?: string;
}

export function CompleteStepClient({ organizationId }: CompleteStepClientProps) {
    const { formData } = useOnboarding();
    const router = useRouter();

    // Safeguard: redirect to first step if user hasn't completed the flow
    useEffect(() => {
        if (!formData.sitePublishUrl) {
            console.warn("[CompleteStepClient] No sitePublishUrl found, redirecting to start");
            router.replace("/get-started/docs");
        }
    }, [formData.sitePublishUrl, router]);

    // Don't render until we've verified completion state
    if (!formData.sitePublishUrl) {
        return null;
    }

    // Generate orgName from docs URL if not provided
    const effectiveOrgName = organizationId || generateOrgIdFromDocsUrl(formData.docsSiteUrl);

    return <ConfirmScreen orgName={effectiveOrgName} docsUrl={formData.docsSiteUrl} wizardFormData={formData} />;
}
