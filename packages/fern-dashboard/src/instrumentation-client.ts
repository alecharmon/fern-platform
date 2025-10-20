// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";
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
        }
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
