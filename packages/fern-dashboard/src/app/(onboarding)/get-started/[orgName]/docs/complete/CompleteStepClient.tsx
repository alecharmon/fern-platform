"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface CompleteStepClientProps {
    organizationId: string;
}

/**
 * CompleteStepClient now just redirects to the publishing page.
 * The LoaderScreen on the publishing page handles the full flow.
 */
export function CompleteStepClient({ organizationId }: CompleteStepClientProps) {
    const router = useRouter();

    useEffect(() => {
        // Redirect to publishing page which has the cards UI
        router.replace(`/get-started/${organizationId}/docs/publishing`);
    }, [organizationId, router]);

    return null;
}
