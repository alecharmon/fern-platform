// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { POSTHOG_UI_HOST } from "@/app/services/posthog/types";
import { getBuildTimestamp } from "@/utils/buildTimestamp";
import { isProduction } from "@/utils/environment";

import { baseConfig } from "../sentry.base.config";

if (isProduction()) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        ...baseConfig,
        initialScope: (scope) => {
            const buildTimestamp = getBuildTimestamp();
            if (buildTimestamp) {
                scope.setTag("buildTimestamp", buildTimestamp);
            }
            return scope;
        },
        // Experimental: attach PostHog session replay URL to Sentry events to surface in Slack alerts
        beforeSend(event) {
            try {
                const sessionReplayUrl = posthog.get_session_replay_url?.({ withTimestamp: true });
                if (sessionReplayUrl) {
                    // Transform the relative proxy URL to a full PostHog URL
                    // The proxy returns URLs like "/ingest/project/..." but we need "https://us.posthog.com/project/..."
                    const fullSessionReplayUrl = sessionReplayUrl.replace(/^\/ingest/, POSTHOG_UI_HOST);
                    event.tags = { ...(event.tags ?? {}), posthogSessionReplayUrl: fullSessionReplayUrl };
                    event.contexts = { ...(event.contexts ?? {}), posthog: { sessionReplayUrl: fullSessionReplayUrl } };
                }
            } catch (error) {
                console.error("Failed to attach PostHog session replay URL to Sentry event:", error);
            }
            return event;
        }
    });
    Sentry.metrics.count("user_action", 1);
    Sentry.metrics.distribution("api_response_time", 150);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
