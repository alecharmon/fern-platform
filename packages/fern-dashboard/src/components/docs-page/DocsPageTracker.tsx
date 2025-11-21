"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

import { captureEvent, PosthogEventName } from "@/components/posthog/events";

export declare namespace DocsPageTracker {
    export interface Props {
        orgName: string;
        docsUrl: string;
        userEmail: string;
    }
}

export function DocsPageTracker({ orgName, docsUrl, userEmail }: DocsPageTracker.Props) {
    const posthog = usePostHog();

    useEffect(() => {
        captureEvent(posthog, PosthogEventName.DOCS_PAGE_VIEWED, {
            orgName,
            docsUrl,
            userEmail
        });
    }, [posthog, orgName, docsUrl, userEmail]);

    return null;
}
