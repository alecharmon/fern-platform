"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { usePostHog } from "posthog-js/react";

export function PostHogPageView() {
    return (
        // We wrap this in Suspense to avoid the `useSearchParams` usage above
        // from de-opting the whole app into client-side rendering
        // See: https://nextjs.org/docs/messages/deopted-into-client-rendering
        <Suspense fallback={null}>
            <NonSuspendedPostHogPageView />
        </Suspense>
    );
}

function NonSuspendedPostHogPageView() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const posthog = usePostHog();

    useEffect(() => {
        if (pathname && posthog) {
            let url = window.origin + pathname;
            if (searchParams.toString()) {
                url = url + `?${searchParams.toString()}`;
            }

            posthog.capture("$pageview", { $current_url: url });
        }
    }, [pathname, searchParams, posthog]);

    return null;
}
