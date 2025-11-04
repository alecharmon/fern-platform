// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { getBuildTimestamp } from "@/utils/buildTimestamp";
import { isProduction } from "@/utils/environment";

import { baseConfig } from "../sentry.base.config";

if (isProduction()) {
    Sentry.init({
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
                    event.tags = { ...(event.tags ?? {}), posthogSessionReplayUrl: sessionReplayUrl };
                    event.contexts = { ...(event.contexts ?? {}), posthog: { sessionReplayUrl } };
                }
            } catch (error) {
                console.error("Failed to attach PostHog session replay URL to Sentry event:", error);
            }
            return event;
        }
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
