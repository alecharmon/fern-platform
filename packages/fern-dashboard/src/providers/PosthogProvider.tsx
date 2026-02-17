"use client";

import { useParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import type React from "react";
import { useEffect } from "react";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { PostHogPageView } from "@/components/posthog/PostHogPageView";
import { getBuildTimestamp } from "@/utils/buildTimestamp";
import { isProduction } from "@/utils/environment";

export declare namespace PostHogProvider {
    export interface Props {
        session: Auth0SessionData | undefined;
        children: React.JSX.Element;
    }
}

export function PostHogProvider({ session, children }: PostHogProvider.Props) {
    const params = useParams();
    const orgName = params.orgName as Auth0OrgName;

    useEffect(() => {
        if (!isPosthogTrackingEnabled()) {
            return;
        }

        if (process.env.NEXT_PUBLIC_POSTHOG_KEY == null) {
            throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not defined in the environment");
        }

        // Initialize PostHog client
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
            api_host: "/ingest",
            capture_pageview: isProduction(),
            // Experimental: enable session recording to capture replay URLs for Sentry error context
            session_recording: {
                recordCrossOriginIframes: true
            }
        });

        // Register build timestamp as a super property and include it in ALL events automatically
        const buildTimestamp = getBuildTimestamp();
        if (buildTimestamp) {
            posthog.register({ buildTimestamp });
        }
    }, []);

    useEffect(() => {
        if (!isPosthogTrackingEnabled()) {
            return;
        }

        // Identify user immediately after initialization to prevent anonymous UUID sessions
        if (session?.user != null) {
            posthog.identify(session.user.sub, {
                email: session.user.email,
                name: session.user.name
            });
            posthog.setPersonPropertiesForFlags({
                email: session.user.email
            });
        }
    }, [session?.user, session?.user.sub, session?.user.email, session?.user.name]);

    useEffect(() => {
        if (!isPosthogTrackingEnabled()) {
            return;
        }

        // Register organization as a super property and include it in ALL events automatically
        if (orgName) {
            posthog.register({ orgName: orgName });
            posthog.setPersonPropertiesForFlags({ orgName: orgName });
            posthog.reloadFeatureFlags();
        }
    }, [orgName]);

    return (
        <PHProvider client={posthog}>
            {isPosthogTrackingEnabled() && (
                <>
                    <PostHogPageView />
                </>
            )}
            {children}
        </PHProvider>
    );
}

function isPosthogTrackingEnabled() {
    return process.env.NEXT_PUBLIC_POSTHOG_TRACKING_ENABLED === "true";
}
