"use client";

import { useRouter } from "@bprogress/next/app";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef } from "react";
import { CreateOrganizationForm } from "@/components/auth/CreateOrganizationForm";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";

interface CreateOrganizationStepClientProps {
    accessToken: string;
    nextHref: string;
    initialOrgName?: string;
}

export function CreateOrganizationStepClient({
    accessToken,
    nextHref,
    initialOrgName
}: CreateOrganizationStepClientProps) {
    const router = useRouter();
    const posthog = usePostHog();
    const hasTrackedView = useRef(false);

    // Track when the create organization step is viewed
    useEffect(() => {
        if (!hasTrackedView.current) {
            captureEvent(posthog, PosthogEventName.CREATE_ORGANIZATION_STEP_VIEWED, {
                prepopulatedOrgName: initialOrgName
            });
            hasTrackedView.current = true;
        }
    }, [posthog, initialOrgName]);

    const handleSuccess = useCallback(
        (organizationId: string) => {
            const destination = nextHref.includes(":orgId") ? nextHref.replace(/:orgId/g, organizationId) : nextHref;
            router.push(destination);
        },
        [nextHref, router]
    );

    return (
        <CreateOrganizationForm
            accessToken={accessToken}
            onSuccess={handleSuccess}
            hideLabel
            submitButtonText="Continue"
            initialOrganizationName={initialOrgName}
        />
    );
}
