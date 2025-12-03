import * as Sentry from "@sentry/nextjs";

import { isProduction } from "@/utils/environment";

import { baseConfig } from "./sentry.base.config";

if (isProduction()) {
    Sentry.init({ ...baseConfig });
    Sentry.metrics.count("user_action", 1);
    Sentry.metrics.distribution("api_response_time", 150);
}
