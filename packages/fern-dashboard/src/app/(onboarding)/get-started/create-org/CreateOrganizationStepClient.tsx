"use client";

import { useRouter } from "@bprogress/next/app";
import { useCallback } from "react";
import { CreateOrganizationForm } from "@/components/auth/CreateOrganizationForm";

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
