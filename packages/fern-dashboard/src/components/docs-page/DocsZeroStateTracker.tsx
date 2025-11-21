"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { captureEvent, PosthogEventName } from "@/components/posthog/events";

export declare namespace DocsZeroStateTracker {
    export interface Props {
        hasOrgName: boolean;
        userEmail: string;
    }
}

export function DocsZeroStateTracker({ hasOrgName, userEmail }: DocsZeroStateTracker.Props) {
    const posthog = usePostHog();

    useEffect(() => {
        captureEvent(posthog, PosthogEventName.DOCS_ZERO_STATE_VIEWED, {
            hasOrgName,
            userEmail
        });
    }, [posthog, hasOrgName, userEmail]);

    return null;
}
